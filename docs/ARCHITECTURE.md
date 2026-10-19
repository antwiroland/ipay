# iPay Ghana — Architecture

## 1. Overview

iPay Ghana is a Next.js (App Router, TypeScript) application backed by MongoDB (Mongoose). It sells iPhones on
installment contracts under two purchase models:

| Model | Code | Device handover |
|---|---|---|
| Take & Pay | `take_and_pay` | After approval + confirmed deposit + verified identity. Balance is repaid afterwards. |
| Pay Small-Small | `pay_small_small` | Device is held in storage and released only after the contract is **fully paid**. |

The application is a single deployable (Vercel) with all privileged work done server-side in **server actions** and
**route handlers**, which call a layer of framework-independent **services**.

```
Browser ──► Next.js (RSC pages, server actions, route handlers)
                │  auth context (session cookie → Session collection)
                ▼
          src/server/services/*      ← business rules (pure TS, no next/* imports, unit-testable)
                │
     ┌──────────┼──────────────┬───────────────────┐
     ▼          ▼              ▼                   ▼
 Mongoose   Payment adapters  Notification       Storage adapter
 models     (paystack | mock) adapters            (cloudinary | local-dev)
 (MongoDB)                    (email/sms/in-app)
```

## 2. Source layout

```
src/
  app/                       Routes (public, (auth), account, admin, api)
  components/                UI: ui/ (shadcn-style primitives), store/, account/, admin/
  lib/                       Pure helpers: money, dates, installment math, validation schemas, formatting
  models/                    Mongoose schemas + indexes
  server/
    auth/                    sessions, password hashing, TOTP, guards (requireUser / requirePermission)
    db.ts                    cached connection + withTransaction()
    services/                orders, payments, pricing, installments, inventory, notifications, reports, audit…
    payments/                provider adapter interface + paystack + mock
    notifications/           channel adapters (email, sms) + templates
    storage/                 image upload adapters
    rate-limit.ts            Mongo-backed fixed-window limiter (works across serverless instances)
scripts/                     seed, dev database, e2e server
tests/                       unit/, integration/ (Vitest + mongodb-memory-server replica set), e2e/ (Playwright)
```

Rule: **`src/server/services` never imports `next/*`.** Server actions and route handlers resolve the session,
then pass an explicit `Actor` (`{ userId, role, permissions }`) into services. This keeps every authorization check in
the service execution path (not only middleware/proxy) and lets the integration tests exercise the real rules.

## 3. Money

* All money is stored and computed as **integer pesewas** (`GH₵1.00 = 100`). No floats in financial paths.
* Percentages are stored as **basis points** (`40% = 4000`).
* Rounding: percentage results use round-half-up on integers (`roundBps`).
* Installment split: `base = floor(financed / n)`; the **final installment absorbs the remainder** so the schedule
  always sums exactly to the financed balance.
* Display uses `formatGHS(pesewas)` → `GH₵6,600.00`.

## 4. Pricing & contract snapshot

`quote(product, plan, addOns, now, activeCampaigns)` (in `src/lib/pricing.ts`) is the single source of contract
maths, used by the product-page calculator (display) and by order creation (authoritative, recomputed server-side):

```
base        = effective installment price (product promo price if inside its window, then campaign discount)
addOns      = sum of selected add-on prices
markup      = roundBps(base + addOns, plan.markupBps)          (0 by default; financing charge where lawful)
fees        = sum(plan.fees[].amount)                           (disclosed fixed fees)
contract    = base + addOns + markup + fees                     (= agreedPurchasePrice)
deposit     = percentage ? roundBps(contract, bps) : min(fixed, contract)
financed    = contract − deposit
installments= split(financed, plan.numberOfInstallments)
```

Every order stores an immutable `productSnapshot`, `planSnapshot` (incl. terms text + version) and `pricing`
breakdown. Later product/plan edits never change an existing contract.

## 5. Order lifecycle (three independent status axes)

**orderStatus**

```
submitted ─► under_review ─► awaiting_deposit ─► awaiting_collection ─► active_repayment ─► fully_paid ─► completed
     │             │               │   (take_and_pay)          ▲     (pay_small_small:            │
     │             │               └───────────────────────────┼──── deposit → active_repayment)  │
     └─► rejected ◄┘                                           │                                   │
   cancelled ◄── (submitted | under_review | awaiting_deposit, no net payments)                  │
   suspended ◄─► (awaiting_collection | active_repayment | fully_paid)                           │
```

* "Approved" is recorded as `approvedAt` and the order moves straight to `awaiting_deposit`.
* Take & Pay: deposit confirmed → `awaiting_collection`; staff record collection → `active_repayment`.
  If the balance is cleared before collection the order sits in `fully_paid` until collected.
* Pay Small-Small: deposit confirmed → `active_repayment`; when fully paid → `fully_paid` (device prepared);
  collection/delivery recorded → `completed`.
* `completed` requires **both** repayment `fully_paid` **and** fulfilment `collected | delivered`.
  It is never set by a date passing.

**repaymentStatus** (derived from installments + dates, persisted on every change and by the cron job):
`not_started | current | due_soon | overdue | partially_paid | fully_paid`.

**fulfilmentStatus**: `not_prepared | preparing | ready_for_collection | collected | delivered | cancelled`.

Allowed transitions live in `src/lib/order-status.ts` and are validated server-side.

## 6. One active installment order per customer (concurrency-safe)

* `Order.isActive` is `true` for every non-terminal state (everything except `completed`, `rejected`, `cancelled`).
* A **partial unique index** `{ customerId: 1 }` with `partialFilterExpression: { isActive: true }` makes it physically
  impossible for MongoDB to hold two active orders for one customer.
* Order creation runs in a transaction: (1) friendly pre-check, (2) atomic conditional stock reservation
  (`stockQuantity >= 1` → `$inc -1`), (3) insert order. Concurrent requests that slip past the pre-check fail on the
  unique index (`E11000`) or a transient transaction conflict; both are mapped to `ACTIVE_ORDER_EXISTS` and the
  transaction (including the stock reservation) rolls back.
* `isActive` flips to `false` only inside the same transaction that moves an order to `completed`, `rejected` or
  `cancelled`; that is the moment eligibility is released.
* Tested in `tests/integration/orders.concurrency.test.ts` with 10 parallel submissions.

## 7. Payments

Provider adapter interface (`src/server/payments/types.ts`): `initialize`, `verify`, `verifyWebhookSignature`,
`parseWebhook`, `refund`. Implementations: `paystack` (live/test keys) and `mock` (development only; refused when
`NODE_ENV=production` unless `ALLOW_MOCK_PAYMENTS=true`; every mock payment is stored with `isTest: true` and shown
with a **DEV SANDBOX** label). Hubtel can be added by implementing the same interface.

Flow:

1. `initiatePayment(actor, orderId, kind, amount?)` — validates ownership, order state and permitted payment kinds;
   computes the amount server-side (deposit = exact deposit; installment = next outstanding; full = outstanding;
   custom partial/additional only if settings allow and `≤ outstanding`). Creates `Payment{status: pending}` with a
   unique reference and calls the provider.
2. Provider webhook (`/api/webhooks/paystack`) → signature check on raw body → `confirmPayment(reference)`; the
   callback page also triggers server-side verification so the UI is not dependent on webhook latency.
3. `confirmPayment` always re-verifies with the provider (amount, currency, reference, status). Inside a transaction it
   atomically claims the payment (`status ∈ {pending, processing, expired} → confirmed`). A duplicate webhook finds the
   payment already confirmed and is a no-op ⇒ **idempotent**.
4. Allocation: oldest-outstanding-installment-first waterfall. Anything above the order's outstanding balance (possible
   if two checkouts complete) is stored as `unallocatedAmount`, flagged `reconciliationStatus = needs_review`, and is
   **never** counted toward the balance.
5. A `LedgerEntry` (append-only) is written for every allocation, refund and reversal. `Order.amountPaid` and
   `outstandingBalance` are cached projections of the ledger; `reconcileOrder()` recomputes them from the ledger and
   reports drift (exposed in admin order detail).
6. Order status/repayment status re-evaluated; receipt available; notifications sent with a dedupe key
   (`payment-confirmed:<reference>`) so repeated webhooks never send duplicates.

Refunds/reversals: explicit `Refund` records, permission `payments.refund`, reason required, audited. Allocation is
unwound newest-installment-first, ledger gets a negative entry, `fully_paid` orders return to `active_repayment`.
Refunds against a `completed` order are refused (handled offline/with a documented correction) because reopening it
could conflict with a newer active order.

Manual payments (cash/bank transfer at the shop) are an auditable financial correction: permission
`payments.manual`, reason required, provider `manual`.

## 8. Authentication & authorization

* Custom database sessions: 32-byte random token in an `httpOnly`, `Secure`, `SameSite=Lax` cookie; only its SHA-256
  hash is stored (`Session` collection, TTL index). Suspension or password change revokes sessions.
* Passwords hashed with Node `scrypt` (N=16384, r=8, p=1, 16-byte salt) and constant-time comparison.
* Password reset: single-use, hashed, 30-minute token; responses never reveal whether an email exists.
* Staff MFA: RFC 6238 TOTP (implemented with `node:crypto`). Can be made mandatory for staff via settings.
* Roles → permissions in `src/lib/permissions.ts`; `requirePermission(actor, perm)` is called in every privileged
  service function. The proxy/middleware only performs coarse redirects.
* Server actions get Next's built-in Origin check (CSRF); mutating route handlers verify `Origin`/`Host` too.

## 9. Real-time updates

The account dashboard uses ordinary server rendering plus a small client `AutoRefresh` component that calls
`router.refresh()` on window focus and polls every 5 s while a payment is pending (the payment return page polls the
payment status endpoint). No websocket infrastructure is required.

## 10. Scheduled jobs

`/api/cron/daily` (Vercel Cron, `Authorization: Bearer $CRON_SECRET`):
expire stale pending payments, refresh installment/repayment statuses, send due-soon and overdue reminders
(deduplicated per installment per day), and expire campaigns.

## 11. Business assumptions (confirm with the business owner)

1. Ghana uses GMT (UTC+0) year-round; all dates are computed in UTC.
2. The installment schedule starts at deposit confirmation (first due date one period later).
3. No automatic late fees are charged; the plan's late-payment policy is disclosed text only.
4. Stock is reserved when the application is submitted and released on rejection/cancellation.
5. Plans flagged `requiresVerification` (default for Take & Pay) need the customer's identity verification to be at
   least submitted to apply and `verified` before approval.
6. Identity verification is a staff-reviewed workflow; the system stores only the ID type, last 4 characters and a keyed
   hash of the ID number. It does **not** claim automated Ghana Card verification.
7. Seed product imagery is generated vector renders; real product photography should be uploaded via admin.

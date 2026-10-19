# Database schema

MongoDB via Mongoose (`src/models`). All money fields are **integer pesewas**; percentages are **basis points**.
Transactions require a replica set (Atlas, or `npm run db:dev` locally).

## Collections

| Model | Purpose | Key indexes |
|---|---|---|
| `User` | Customers and staff. `passwordHash` (scrypt), `role`, `verificationStatus`, `accountStatus`, notification preferences, consents, encrypted TOTP secret. | `email` unique, `phone` unique (both normalised), `role`, text(name,email,phone) |
| `Session` | DB-backed sessions. Only SHA-256 of the cookie token is stored. | `tokenHash` unique, TTL on `expiresAt`, `userId` |
| `AuthToken` | Single-use password-reset tokens (hashed, 30 min). | `tokenHash` unique, TTL |
| `RateLimit` | Fixed-window counters shared across instances. | TTL on `expiresAt` |
| `Product` | Catalogue: model, series, storage, colours, condition, images, specs, `cashPrice`, `installmentPrice`, `costPrice`, promo prices + window, add-ons, allowed `planIds`, `stockQuantity`, publish/feature/available/archive flags. | `slug` unique, `(isPublished,isArchived,isFeatured,createdAt)`, `(isPublished,installmentPrice)`, text |
| `PaymentPlan` | Plan templates: purchase model, deposit type/value, frequency, count, `markupBps`, fees, due-day rule, grace period, late policy, eligibility, partial/additional flags, `termsVersion` + `termsText`. | `code` unique, `(isActive,sortOrder)` |
| `Order` | Contract: immutable `productSnapshot`, `planSnapshot`, `pricing` breakdown, `agreedPurchasePrice`, `depositAmount`, cached `amountPaid`/`outstandingBalance`, three status axes, `isActive`, status history, milestone dates. | `orderNumber` unique, **`one_active_order_per_customer`: unique `{customerId}` partial on `{isActive:true}`**, `(customerId,createdAt)`, `(orderStatus,createdAt)`, `repaymentStatus`, `activatedAt`, `nextDueDate` |
| `Installment` | Schedule rows: number, due date, amount due/paid/outstanding, status, last payment. | `(orderId,installmentNumber)` unique, `(customerId,dueDate)`, `(status,dueDate)` |
| `Payment` | Every attempt: reference, provider ref, kind, amount, allocated / unallocated / refunded amounts, provider, method, `isTest`, status, reconciliation status. Never overwritten to hide history. | `reference` unique, `providerReference`, `(customerId,createdAt)`, `(orderId,createdAt)`, `(status,verifiedAt)`, `(status,expiresAt)` |
| `PaymentAllocation` | **Append-only.** Which installment (0 = deposit) each payment / refund unwind touched. | `paymentId`, `orderId`, `installmentId` |
| `LedgerEntry` | **Append-only financial ledger.** Signed amounts applied to order balances (`payment`, `manual_payment`, `refund`, `reversal`). | `orderId`, `customerId`, `createdAt`, unique `(paymentId,type)` for credits (second guard against double counting) |
| `Refund` | Refund / reversal records with reason, actor, split between unallocated and balance. | `paymentId`, `orderId` |
| `Promotion` | Banners/campaigns: copy, desktop + mobile image, CTA, destination, linked products, optional discount, schedule, status, order, impressions/clicks. | `(status,startDate,endDate,displayOrder)` |
| `Notification` | In-app / email / SMS log with delivery status. `dedupeKey` makes repeated triggers no-ops. | `(userId,channel,createdAt)`, **unique partial `dedupeKey`** |
| `NotificationTemplate` | Admin overrides of default templates. | `key` unique |
| `AuditLog` | **Append-only.** actor, role, action, resource, reason, metadata, IP, timestamp. | `timestamp`, `(resourceType,resourceId)`, `actorId`, `action` |
| `InventoryMovement` | **Append-only.** restock / reserve / release / adjustment / dispatch with stock-after. | `productId`, `createdAt` |
| `IdentityVerification` | ID type, last 4, keyed HMAC of the ID number, DOB, status, reviewer. No document images. | `userId`, `(idHash,status)` |
| `CustomerNote` | Internal staff notes. | `customerId` |
| `Counter` | Atomic sequences (order numbers per year). | `_id` |
| `Setting` | Singleton `_id: "global"`: menu label, purchase-model switches, reminder days, checkout TTL, staff-MFA policy, support contacts. | — |
| `Review`, `Subscriber`, `ContactMessage` | Moderated reviews (one per order), newsletter consent, contact inbox. | `orderId` unique, `email` unique |
| `MockCharge` | Development sandbox provider state only. | `_id` = reference |

## Append-only enforcement

`makeAppendOnly()` (src/models/_helpers.ts) registers pre-hooks that throw on every update/delete query and on
re-saving an existing document for `LedgerEntry`, `PaymentAllocation`, `AuditLog`, `InventoryMovement`.
At the database level, give the production application user a role **without** `remove`/`update` on these
collections for defence in depth (see SECURITY.md).

## How the one-active-order mechanism interacts with other flows

| Flow | Effect on `isActive` |
|---|---|
| `createOrder` | Inserts with `isActive: true` inside a transaction that also reserves stock. Duplicate-key → `ACTIVE_ORDER_EXISTS`, whole transaction (incl. stock) rolls back. |
| Payments / deposits / fully paid | No change — a fully paid order awaiting collection is still active. |
| Fulfilment `collected`/`delivered` on a fully paid order → `completed` | `isActive: false` in the same transaction. |
| `rejectOrder`, `cancelOrder` | `isActive: false` + stock released in the same transaction. |
| Refund on a completed order | Refused (would need to re-activate an order the customer may have replaced). |

## Reconciliation invariant

For every order: `Σ LedgerEntry.amount = Order.amountPaid = Σ PaymentAllocation.amount = Σ Installment.amountPaid + deposit allocations`
and `outstandingBalance = max(0, agreedPurchasePrice − amountPaid)`. `reconcileOrder()` checks it; the admin order page
shows the result on every view.

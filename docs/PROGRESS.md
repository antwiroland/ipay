# Development progress

## Current status — 2026-10-19

- **Active phase:** 9 (Deployment) — app runs locally against MongoDB Atlas; production deploy not done.
- **Payments:** `PAYMENT_PROVIDER=paystack` is configured, but **no Paystack key has been provided yet**. Until
  `PAYSTACK_SECRET_KEY` (sk_test_…) is added to `.env.local`, "Continue to secure payment" shows a friendly
  "couldn't start the payment" error. Seeded demo payments were created with the sandbox provider and are labelled "Dev sandbox".
- **Blockers / external:** Paystack test & live keys, Resend, Hubtel SMS, Cloudinary, legal review, real product photos.
- **Next steps:** add Paystack test key → run a real test-mode payment → register the webhook on a public URL
  (ngrok / Vercel preview) → deploy to Vercel → rotate the Atlas password (it was shared in chat).

## Checklist

### Phase 1: Planning and Architecture
- [x] Inspect the existing repository (empty directory; scaffolded with create-next-app 16.4.2)
- [x] Confirm business requirements (assumptions recorded in ARCHITECTURE.md §11)
- [x] Design application architecture
- [x] Design database schemas and indexes
- [x] Define authentication and authorization
- [x] Define payment, order, and fulfilment lifecycles

### Phase 2: UI/UX and Design System
- [x] Establish the brand palette and typography
- [x] Build the responsive navigation
- [x] Create reusable UI components
- [x] Build the homepage
- [x] Build the product catalogue
- [x] Build product detail pages
- [x] Build customer and admin layouts

### Phase 3: Database and Authentication
- [x] Configure MongoDB (Atlas connected; transactions verified)
- [x] Create models and indexes
- [x] Implement registration and login
- [x] Implement password recovery (email delivery needs Resend in production)
- [x] Implement role-based authorization
- [x] Create development seed data

### Phase 4: Storefront and Administration
- [x] Implement product management
- [x] Implement inventory management
- [x] Implement installment-plan management
- [x] Implement promotional banners
- [x] Connect storefront content to MongoDB
- [x] Implement customer management

### Phase 5: Orders and Installments
- [x] Implement installment applications
- [x] Enforce the one-active-order rule
- [x] Implement concurrency protection
- [x] Generate installment schedules
- [x] Implement customer order pages
- [x] Implement repayment tracking
- [x] Implement order completion logic

### Phase 6: Payments
- [x] Implement the payment-provider adapter (Paystack + sandbox)
- [x] Implement payment initialization (sandbox tested; **Paystack not yet exercised — no key**)
- [x] Implement webhook verification (signature logic implemented; Paystack webhook not yet received live)
- [x] Implement idempotent payment processing
- [x] Implement payment allocation
- [x] Implement outstanding balance calculations
- [x] Implement payment history and receipts
- [x] Implement settlement statements
- [x] Implement refunds and reversals where supported (Paystack refund API call untested without key)

### Phase 7: Notifications and Reporting
- [x] Implement email notifications (Resend adapter; console in dev — not tested against Resend)
- [ ] Implement configured SMS or WhatsApp integration (Hubtel SMS adapter written, untested without credentials; WhatsApp not implemented)
- [x] Implement payment reminders (daily cron job)
- [x] Build admin statistics
- [x] Build financial charts
- [x] Implement CSV exports
- [x] Implement audit logs

### Phase 8: Testing and Security
- [x] Test authentication and permissions
- [x] Test one-active-order enforcement
- [x] Test concurrent order requests
- [x] Test payment verification
- [x] Test duplicate webhook handling
- [x] Test installment calculations
- [x] Test refunds and reversals
- [ ] Test responsive layouts (Playwright specs written; browsers not installed here, so not yet run)
- [x] Fix critical defects

### Phase 9: Deployment
- [ ] Configure production environment variables
- [x] Configure MongoDB Atlas (dev database `ipay`; indexes built)
- [ ] Configure image storage
- [ ] Configure payment-provider credentials
- [ ] Configure authentication and email
- [ ] Deploy the application
- [ ] Verify production flows
- [x] Document backups and recovery

## Test runs (actual results)

| Date | Command | Result |
|---|---|---|
| 2026-10-19 | `npx tsc --noEmit` | 2 errors (session meta nullability) → fixed → **0 errors** |
| 2026-10-19 | `npx vitest run tests/unit` | 30/31 — one wrong expectation in the grace-window test → fixed → **31/31** |
| 2026-10-19 | `npx vitest run tests/integration` | 10/30 — **real bug**: money validator rejected `null` optional promo prices (admin product create would fail) → fixed → **30/30** |
| 2026-10-19 | `npx vitest run` (×3) | First run 59/61 — flaky random test phone numbers colliding on the unique index → made deterministic → **61/61 three runs in a row** |
| 2026-10-19 | `npx eslint src tests scripts` | 11 problems (unescaped quotes, `Date.now` in render, unused var) → fixed → **0** |
| 2026-10-19 | `npm run seed` (Atlas) | OK — 11 products, 4 plans, 4 orders, 9 sandbox payments, 48 installments. Ama's order = GH₵6,600 / paid GH₵3,960 / outstanding GH₵2,640 / 60 % (spec example); ledger reconciles |
| 2026-10-19 | `next dev` + HTTP smoke test | 15 public routes 200; signed-out `/account` `/admin` → 307 login; 10 customer pages 200; 23 admin pages + CSV export 200 as Super Admin; Sales Officer denied payments/staff/export (307 / 403); customer bounced from `/admin`; **0 server errors** |
| — | `npm run test:e2e` | **Not run** — Playwright browsers not installed on this machine |

## Log

### 2026-10-19 — Phases 1–8 (initial build)
- Scaffolded Next.js 16.4.2 / React 19.3 / Tailwind 4 / Mongoose 9 / Zod 4. Network was very slow; two installs failed (TLS reset, stale cache) before a clean install succeeded.
- Wrote ARCHITECTURE, DATABASE_SCHEMA, API, SECURITY, DEPLOYMENT, TESTING docs.
- Core: integer-pesewa money lib, `quote()` contract maths, schedule dates, allocation/unwind policy, status derivation, permissions.
- Models (22 collections) with append-only ledger/allocations/audit/inventory and the `one_active_order_per_customer` partial unique index.
- Services: auth (DB sessions, scrypt, TOTP), orders, payments (initiate/confirm/allocate/refund/manual/reconcile), catalog, products, plans, promotions, customers/verification/staff, reports, notifications, daily jobs.
- UI: storefront (home, shop, product + calculator, how-it-works, promotions, FAQ, contact, legal), auth pages, customer area (dashboard, orders, schedule, payments, receipts, statements, profile/verification, notifications, reviews), admin (overview + charts, customers, products, plans, orders, payments, repayment tracking, promotions, notifications, reports, staff, audit, settings, MFA).
- Route handlers: Paystack + sandbox webhooks, cron, promo click tracking, uploads, CSV exports.

### 2026-10-19 — Atlas + Paystack configuration (user request)
- `.env.local` created (gitignored) with the provided Atlas cluster and `PAYMENT_PROVIDER=paystack`; fresh random secrets generated.
- Node could not resolve the Atlas `mongodb+srv` SRV/TXT records on this network (`querySrv ECONNREFUSED`, then `queryTxt ETIMEOUT`). Switched `.env.local` to the equivalent standard seed-list URI (same cluster/credentials, replica set `atlas-7nbfie-shard-0`). Added optional `DNS_SERVERS` support in `src/server/db.ts` for similar machines.
- Seed now always uses the sandbox provider for its demo payments and refuses to run in production.

### 2026-10-19 — UI fix (user request)
- Product cards: "Buy on installments" overflowed in narrow 3–4 column grids. Buttons now stack: full-width primary action, then a quiet "View details" link.

## Changed files summary
`src/lib/*`, `src/models/*`, `src/server/**`, `src/app/**` (store, account, admin, api, dev), `src/components/**`,
`scripts/{seed,dev-db,e2e-server,device-art}.ts`, `tests/{unit,integration,e2e}/**`, `docs/*`, `next.config.ts`,
`vitest.config.ts`, `playwright.config.ts`, `vercel.json`, `.env.example`, `.gitignore`, `package.json`, `README.md`.

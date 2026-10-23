# iPay Ghana

**GET YOUR IPHONE NOW. PAY KOKOOKO LATER** — a premium iPhone storefront with installment purchasing for Ghana.

Customers browse brand-new and UK-used iPhones, choose a **Take & Pay** or **Pay Small-Small** plan, pay a deposit
and keep paying (Mobile Money / card) until the agreed price is settled — with a live balance, schedule, receipts and
statements. Staff manage products, plans, applications, fulfilment, payments, refunds, promotions, notifications,
reports, roles and audit logs.

## Highlights

- **One active installment order per customer**, guaranteed by a partial unique index inside a transaction — not by the UI.
- **Exact money**: integer pesewas everywhere; schedules always reconcile to the financed balance.
- **Verified, idempotent payments**: server-computed amounts, provider re-verification, atomic claim, append-only ledger, reconciliation on every admin order view.
- **Immutable contracts**: product, plan, price breakdown and terms are snapshotted on each order.
- **Separate status axes**: order lifecycle, repayment status and fulfilment; completion needs full payment **and** hand-over.
- **Development sandbox** payment provider (clearly labelled, refused in production) so the full flow works without merchant credentials.

## Stack

Next.js 16 (App Router, TypeScript) · React 19 · Tailwind CSS 4 · shadcn/ui-style components on Radix · Lucide ·
Framer Motion · MongoDB + Mongoose 9 · Zod 4 · React Hook Form · Recharts · Paystack adapter · Resend / Hubtel SMS ·
Cloudinary · Vitest · Playwright · Vercel.

Authentication is implemented in-house (database sessions, scrypt, TOTP MFA) rather than Auth.js — Auth.js v5 was
still in beta, and DB sessions give instant revocation on suspension / role change. See `docs/ARCHITECTURE.md`.

## Quick start

```bash
npm install
cp .env.example .env.local     # set AUTH_SECRET, APP_ENCRYPTION_KEY, ID_HASH_SECRET (any long random strings locally)
npm run db:dev                 # terminal 1: local MongoDB replica set on :27027
npm run seed:reset             # demo catalogue, plans, campaigns, staff and customers
npm run dev                    # http://localhost:3000
```

### Demo accounts (seed only — never seed production)

| Role | Email | Password |
|---|---|---|
| Customer with active plan (60% paid — spec example) | ama@example.com | Customer123! |
| Customer with completed plan | kwame@example.com | Customer123! |
| Customer on Pay Small-Small | efua@example.com | Customer123! |
| Customer awaiting deposit | yaw@example.com | Customer123! |
| Super Admin / Admin / Finance / Sales / Support | superadmin@ / admin@ / finance@ / sales@ / support@ipayghana.test | Admin12345! |

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run db:dev` | Persistent local replica set (`./.data/mongo`) |
| `npm run seed` / `seed:reset` | Demo data via the real services (`--reset` drops the DB first) |
| `npm test`, `test:unit`, `test:integration`, `test:e2e` | See `docs/TESTING.md` |
| `npm run typecheck`, `npm run lint` | Static checks |

## Documentation

- `docs/ARCHITECTURE.md` — design, lifecycles, payment flow, business assumptions
- `docs/DATABASE_SCHEMA.md` — collections, indexes, invariants
- `docs/API_DOCUMENTATION.md` — route handlers, server actions, provider adapter
- `docs/SECURITY.md` — controls, retention, launch hardening
- `docs/DEPLOYMENT.md` — Atlas, Vercel, integrations, backups
- `docs/TESTING.md` — test strategy and commands
- `docs/PROGRESS.md` — development progress log

## Externally dependent (needs credentials / approval)

Paystack live payments & refunds, Resend email, Hubtel SMS, Cloudinary storage, production identity-verification
provider (currently a staff-reviewed workflow), WhatsApp messaging (not implemented), Hubtel payments adapter (interface
ready, not implemented). Legal review of terms and privacy policy is required before launch.
"# ipay" 

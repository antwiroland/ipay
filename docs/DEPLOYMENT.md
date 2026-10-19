# Deployment

Target: **Vercel** (app + cron) and **MongoDB Atlas** (replica set — required for transactions).

## 1. MongoDB Atlas
1. Create a cluster (M10+ recommended for production backups/PITR; M0 is fine for staging).
2. Create a database user (see SECURITY.md for the restricted role) and allow Vercel egress (Atlas → Network Access; use 0.0.0.0/0 with strong credentials, or Vercel's static IPs on Pro/Enterprise).
3. Copy the `mongodb+srv://…` URI into `MONGODB_URI`, set `MONGODB_DB=ipay`.
4. Build indexes once: run `MONGODB_AUTO_INDEX=true npm run seed` against an empty staging DB, or set `MONGODB_AUTO_INDEX=true` for the first production deploy and then switch it off. **The `one_active_order_per_customer` index must exist before go-live.** Verify with `db.orders.getIndexes()`.

## 2. Third-party services
| Service | Variables | Notes |
|---|---|---|
| Paystack | `PAYMENT_PROVIDER=paystack`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY` | Webhook URL: `https://<domain>/api/webhooks/paystack`. Enable Mobile Money + card for GHS. Merchant approval required. |
| Resend | `RESEND_API_KEY`, `EMAIL_FROM` | Verify the sending domain (SPF/DKIM). |
| Hubtel SMS | `HUBTEL_SMS_CLIENT_ID`, `HUBTEL_SMS_CLIENT_SECRET`, `HUBTEL_SMS_SENDER` | Register the sender ID. |
| Cloudinary | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Required in production (local uploads are not persistent on Vercel). |

## 3. Vercel
1. Import the repository; framework preset Next.js; Node 20+.
2. Add all variables from `.env.example` (Production + Preview). Generate secrets with
   `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
3. `APP_URL` = the canonical https URL.
4. `vercel.json` schedules `/api/cron/daily` at 07:00 UTC (07:00 in Ghana). Set `CRON_SECRET` — Vercel sends it as a Bearer token.
5. Deploy. Then create the first Super Admin (see below) and enable "Require 2FA for all staff".

### Creating the first Super Admin in production
Do not run the demo seed in production. Instead, register a normal account on the site, then promote it once in the
Atlas shell: `db.users.updateOne({ email: "owner@yourdomain" }, { $set: { role: "super_admin" } })` and sign in again.
Create further staff from **Admin → Staff & Roles**.

## 4. Go-live checklist
- [ ] `PAYMENT_PROVIDER=paystack` with **live** keys; `ALLOW_MOCK_PAYMENTS` unset/false (the sandbox banner must be gone)
- [ ] Paystack webhook delivers (check Admin → Payments shows "matched")
- [ ] Test a real GH₵1 payment and a refund
- [ ] Email + SMS delivery visible as "sent" in Admin → Notifications
- [ ] Cron run visible in Audit Logs (`system.daily_jobs`)
- [ ] Backups + restore test documented
- [ ] Legal review of terms/privacy completed
- [ ] Products uploaded with real photography; demo data absent

## 5. Backups & recovery
- Atlas Cloud Backup with PITR; snapshot retention ≥ 35 days.
- Recovery: restore to a new cluster → point `MONGODB_URI` at it → redeploy → run `reconcileOrder` spot-checks
  (Admin order pages show reconciliation status) → re-verify payments that were pending at the recovery point using
  **Re-verify with provider** on Admin → Payments (filter status = pending/processing).
- Paystack is the source of truth for money received; any payment confirmed by Paystack but missing after a restore
  is recovered by re-verification because references are unique and confirmation is idempotent.

## Local development
```bash
cp .env.example .env.local      # fill AUTH_SECRET etc. (any long strings locally)
npm install
npm run db:dev                  # terminal 1 — local replica set on :27027 (data in ./.data)
npm run seed:reset              # demo data
npm run dev                     # http://localhost:3000
```

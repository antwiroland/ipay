# Security & privacy

| Control | Implementation |
|---|---|
| Password storage | scrypt (N=16384, r=8, p=1), 16-byte salt, constant-time compare. Uniform login error + dummy hash to resist enumeration/timing. |
| Sessions | 256-bit random token, `httpOnly; Secure; SameSite=Lax` (`__Host-` prefix in production). Only the SHA-256 hash is stored. 14 days customers / 12 h staff. Revoked on suspension, role change, password change/reset. |
| MFA | RFC 6238 TOTP for staff; seed AES-256-GCM encrypted at rest; enforced per session; optional "require for all staff" policy. |
| Authorization | Role → permission map (`src/lib/permissions.ts`). Every privileged **service** calls `requirePermission`; pages call `requireStaffPage(permission)`; the proxy only redirects signed-out users. Customers' records are scoped by `customerId === actor.userId`; foreign records return *not found*. |
| Least privilege | Sales cannot view payments, refund, record manual payments or export payment data. Support cannot change money. Only Super Admin manages staff. At least one Super Admin is always kept. |
| PII | Contact details masked unless `customers.pii`. ID verification stores type, last 4, HMAC(ID_HASH_SECRET) and DOB only — no document images. |
| Input validation | Zod on every input; Mongoose `strictQuery`; ids validated before queries; objects with `$` operators are rejected by the schemas (tested). Search terms regex-escaped and length-limited. |
| CSRF | Server actions: Next.js Origin check. Upload route: explicit same-origin check. Cookies `SameSite=Lax`. Webhooks authenticated by signature, not cookies. |
| Rate limiting | Mongo-backed fixed windows: login (per IP & per email), register, forgot/reset, MFA, contact, subscribe, order create, payment init, uploads. |
| Payments | Amount and order ownership computed server-side; provider verification required before confirmation; amount/currency/reference must match; atomic claim → idempotent webhooks; second unique index on ledger credits; excess held unallocated; mock provider refused in production. Secret keys server-only. |
| Financial integrity | Append-only ledger, allocations, audit log and inventory movements (hooks block updates/deletes). Refunds/reversals/manual payments require reason + permission and are audited. Reconciliation shown on every admin order view. |
| Uploads | Magic-byte sniffing (JPG/PNG/WebP/AVIF), 5 MB cap, SVG refused, random file names, Cloudinary signed uploads in production. |
| Redirects & links | `safeInternalPath` for `next=` params; banner destinations limited to internal paths or allow-listed https hosts; promo click route re-validates. |
| Headers | CSP, HSTS (prod), `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy, COOP; `no-store` on account/admin. |
| CSV exports | Permission-gated, audited, formula-injection neutralised. |
| Notifications | Deduplicated per event; reset links never stored in the notification log; respectful templates; debt never disclosed to third parties. |

## Operational recommendations before launch

1. **Database user**: create an Atlas user with `readWrite` on the app DB, plus a custom role that removes `update`/`remove` on `ledgerentries`, `paymentallocations`, `auditlogs`, `inventorymovements`.
2. **Backups**: Atlas continuous cloud backup with point-in-time recovery (M10+). Test a restore quarterly. Keep audit/ledger collections for the statutory retention period.
3. **Secrets**: generate `AUTH_SECRET`, `APP_ENCRYPTION_KEY`, `ID_HASH_SECRET`, `CRON_SECRET` independently; store in Vercel encrypted env vars; rotate on staff departures. Rotating `APP_ENCRYPTION_KEY` requires staff to re-enrol MFA.
4. **Paystack**: whitelist the webhook URL, enable live keys only in production, and turn on IP allow-listing for the webhook if supported.
5. **Staff**: enable "Require 2FA for all staff" in Settings.
6. **Legal**: have the plan terms, privacy policy and late-payment practices reviewed for the Data Protection Act 2012 (Act 843), consumer-protection and Bank of Ghana credit/payment rules. Register with the Data Protection Commission.
7. **Device locking**: not implemented. If ever considered, verify Apple's actual supervision/MDM constraints, obtain explicit informed consent, and take legal advice — never promise hidden or irremovable locks.

## Data retention (proposed — confirm with counsel)

| Data | Retention |
|---|---|
| Orders, payments, ledger, allocations, refunds, audit logs | Statutory financial-record period (commonly 6+ years) |
| Sessions | TTL expiry (≤ 14 days) |
| Password reset tokens | 30 min validity, purged after 24 h |
| Rate-limit counters | Window length |
| Notifications log | 24 months |
| Identity verification fingerprints | Life of account + statutory period; no document images stored |
| Marketing consent | Until withdrawn (withdrawal timestamped) |

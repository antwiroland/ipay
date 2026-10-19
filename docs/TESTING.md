# Testing

| Layer | Tool | Location | What it covers |
|---|---|---|---|
| Unit | Vitest | `tests/unit` | Money maths & rounding, contract quotes (spec example), schedule dates, allocation/unwind policy, status derivation, lifecycle transitions, permissions, password hashing, TOTP (RFC 6238 vectors), field encryption, phone normalisation, open-redirect guard, CSV injection, templates. |
| Integration | Vitest + `mongodb-memory-server` **replica set** (real transactions & indexes) | `tests/integration` | One-active-order (sequential, 10 concurrent requests, DB-level bypass attempt), stock never oversold, rejection releases eligibility, verification gate, terms-version check, contract snapshot immutability, full payment lifecycle (spec example 60%), pending/failed never reduce balance, 8 concurrent duplicate webhooks, amount mismatch → review, cross-customer access, partial-payment rule, excess held unallocated, completion requires hand-over, Pay Small-Small release rule, refund unwinding & re-opening, role-gated refunds/manual payments, append-only ledger, registration/login/injection, session revocation, single-use resets, MFA, role management. |
| End-to-end | Playwright (Chromium desktop + Pixel 7) | `tests/e2e` | Storefront from DB, route protection by role, register → apply → sandbox deposit → blocked second order → failed payment leaves balance → pay off → GH₵0.00 / 100%, admin role gating, mobile nav and no horizontal overflow. |

## Commands

```bash
npm run test:unit          # fast, no database
npm run test:integration   # downloads a MongoDB binary on first run (~100 MB), then cached
npm test                   # both
npx playwright install chromium   # once
npm run test:e2e           # boots an in-memory replica set, seeds it, runs next dev on :3100
npm run typecheck && npm run lint
```

The first integration run downloads the `mongod` binary for your platform into `~/.cache/mongodb-binaries`.
Set `MONGOMS_VERSION` to pin a version. No test ever touches a real database or payment provider.

## Manual QA checklist (responsive & accessibility)

- [ ] 360px, 768px, 1280px widths: home, shop filters, product calculator, checkout dialog, dashboard, admin tables (horizontal scroll).
- [ ] Keyboard only: skip link, nav, product plan radios, dialogs (focus trap + Esc), admin dropdowns.
- [ ] Screen reader labels on icon buttons, progress bars expose values, status badges include text not just colour.
- [ ] Colour contrast: muted text #5b6475 on #faf9f6 ≈ 5.9:1 (AA).

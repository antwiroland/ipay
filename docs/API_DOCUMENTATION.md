# API documentation

Most mutations are **Next.js server actions** (`src/app/actions/*`) — they get Next's built-in Origin check
(CSRF protection) and return a typed `ActionResult`:

```ts
type ActionResult<T> =
  | { ok: true; data: T; message?: string }
  | { ok: false; code: ErrorCode | "INTERNAL"; error: string; fieldErrors?: Record<string, string[]> };
```

Error codes: `UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, VALIDATION, CONFLICT, ACTIVE_ORDER_EXISTS, OUT_OF_STOCK,
NOT_ELIGIBLE, INVALID_STATE, RATE_LIMITED, PAYMENT_PROVIDER, MFA_REQUIRED`.

## Route handlers

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /api/webhooks/paystack` | `x-paystack-signature` HMAC-SHA512 of the raw body | `charge.success` / `charge.failed` → `confirmPayment(reference)` (re-verifies with Paystack; idempotent). 401 bad signature, 500 → Paystack retries. |
| `POST /api/webhooks/mock` | `x-mock-signature` HMAC-SHA256 (`MOCK_WEBHOOK_SECRET`), dev only | Sandbox webhook, body `{ "event": "charge.success", "reference": "IPGP-…" }`. 404 in production. |
| `GET /api/cron/daily` | `Authorization: Bearer $CRON_SECRET` | Expire stale checkouts, refresh statuses, reminders/overdue notices, archive ended campaigns. Returns counts. |
| `GET /api/promotions/:id/click` | public | Counts a click and 302s to the campaign's validated destination. |
| `POST /api/admin/upload?folder=products\|banners` | staff session + `products.manage` / `promotions.manage`, same-origin | Multipart `file`. Magic-byte checked JPG/PNG/WebP/AVIF ≤ 5 MB. Returns `{ url, publicId }`. |
| `GET /api/admin/export/:type` | staff session + permission (below) | CSV (UTF-8 BOM, formula-injection safe). Same filters as the on-screen tables. Audited. |

Export permissions: `payments` → `payments.export`; `orders`, `installments`, `collections`, `sales` →
`reports.export`; `customers` → `reports.export` + `customers.pii`.

## Server actions

### Auth (`actions/auth.ts`)
`registerAction(input, next?)`, `loginAction({email,password}, next?)`, `mfaAction(code, next?)`, `logoutAction()`,
`forgotPasswordAction(email)` (always the same response), `resetPasswordAction({token,password,confirmPassword})`,
`updateProfileAction(input, currentPassword?)`, `changePasswordAction(current, next)`,
`submitVerificationAction({documentType,idNumber,dateOfBirth,consent})`, `beginMfaAction()`, `confirmMfaAction(code)`.

### Customer orders & payments (`actions/orders.ts`)
| Action | Input | Notes |
|---|---|---|
| `applyForOrderAction` | `{ productId, planId, colour, addOnKeys[], acceptTerms: true, termsVersion }` | Price recomputed server-side; one-active-order enforced by unique index; returns `{ orderId, redirectTo }`. |
| `cancelMyOrderAction` | `(orderId, reason)` | Only before deposit, owner only. |
| `startPaymentAction` | `{ orderId, kind: "deposit"\|"installment"\|"full_balance"\|"additional", amount? }` | Amount computed from DB (custom `amount` only for `additional`, ≤ outstanding, plan rules apply). Returns `{ reference, checkoutUrl, amount, isTest }`. |
| `checkPaymentAction` | `(reference)` | Owner only; triggers server-side verification; returns status. |

### Admin (`actions/admin.ts`) — every service call re-checks permissions
`orderAction(orderId, "review"|"approve"|"reject"|"cancel"|"suspend"|"resume"|"complete", note)`,
`fulfilmentAction(orderId, status, note)`, `manualPaymentAction`, `refundAction({paymentId, amount, type, reason})`,
`reverifyAction(paymentId)`, `reconcileAction(paymentId, note)`, `saveProductAction(id|null, input, initialStock)`,
`productFlagsAction`, `stockAction`, `savePlanAction`, `savePromotionAction`, `promotionStatusAction`,
`reorderPromotionsAction`, `customerNoteAction`, `accountStatusAction`, `reviewVerificationAction`,
`createStaffAction`, `changeRoleAction`, `staffStatusAction`, `saveSettingsAction`, `saveTemplateAction`,
`contactHandledAction`, `moderateReviewAction`.

## Payment provider adapter

```ts
interface PaymentProvider {
  name: "paystack" | "mock"; isTest: boolean;
  initialize(i: { reference, amount, currency: "GHS", email, phone?, callbackUrl, metadata }): Promise<{ checkoutUrl, providerReference? }>;
  verify(reference): Promise<{ status: "success"|"failed"|"abandoned"|"pending", amount, currency, reference, providerReference?, method?, channelDetail?, paidAt?, gatewayResponse? }>;
  verifyWebhookSignature(rawBody, signature): boolean;
  parseWebhook(rawBody): { event, reference };
  refund(reference, amount): Promise<{ ok, providerReference?, error? }>;
}
```
Add Hubtel by implementing this interface in `src/server/payments/hubtel.ts` and registering it in `payments/index.ts`.

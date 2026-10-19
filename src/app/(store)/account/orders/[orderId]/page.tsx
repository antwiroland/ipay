import { ChevronRight, FileText, PartyPopper, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/account/auto-refresh";
import { CancelOrderButton } from "@/components/account/cancel-order";
import { InstallmentTable } from "@/components/account/installment-table";
import { PayPanel } from "@/components/account/pay-panel";
import { PaymentSummary } from "@/components/account/payment-summary";
import { ReviewForm } from "@/components/account/review-form";
import { FulfilmentBadge, OrderStatusBadge, PaymentStatusBadge, RepaymentStatusBadge, SandboxBadge } from "@/components/status-badges";
import { ProductImage } from "@/components/store/product-image";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatGHS } from "@/lib/money";
import { PURCHASE_MODEL_LABEL } from "@/lib/pricing";
import { serialize } from "@/lib/utils";
import { requireCustomerPage } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { isSandboxMode } from "@/server/payments";
import { getOrderForActor } from "@/server/services/orders";
import { Review } from "@/models";
import { paymentOptions } from "@/server/services/payments";

export const metadata: Metadata = { title: "Order details" };

export default async function OrderDetailPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ new?: string }> }) {
  const { orderId } = await params;
  const sp = await searchParams;
  const actor = await requireCustomerPage(`/account/orders/${orderId}`);
  let data;
  try {
    data = await getOrderForActor(actor, orderId);
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const { order, installments, payments } = data;
  // Customers only ever see their own orders (getOrderForActor enforces this; staff use the admin view).
  if (order.customerId.toString() !== actor.userId) notFound();
  const opts = await paymentOptions(orderId);
  const pending = payments.some((p) => p.status === "pending" || p.status === "processing");
  const paidCount = installments.filter((i) => i.status === "paid").length;
  const model = order.planSnapshot.purchaseModel;
  const reviewed = order.orderStatus === "completed" ? await Review.exists({ orderId: order._id }) : true;

  return (
    <div className="space-y-6">
      <AutoRefresh pending={pending} />
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[13px] text-muted">
        <Link href="/account/orders" className="hover:text-foreground">My orders</Link>
        <ChevronRight className="size-3.5" /> <span className="text-foreground">{order.orderNumber}</span>
      </nav>

      {sp.new && order.orderStatus !== "cancelled" && (
        <Alert tone="success" title="Application received">
          {order.orderStatus === "awaiting_deposit"
            ? "Your plan is approved. Pay your deposit below to get started."
            : "We're reviewing your application and will notify you by SMS and email, usually within one business day."}
        </Alert>
      )}
      {order.orderStatus === "completed" && (
        <Alert tone="success" icon={<PartyPopper />} title="Congratulations!">
          You have completed your iPay Ghana installment plan. Your outstanding balance is GH₵0.00. You can now explore and order your next device.
        </Alert>
      )}
      {order.orderStatus === "rejected" && <Alert tone="danger" title="Application not approved">{order.rejectionReason}</Alert>}
      {order.orderStatus === "suspended" && <Alert tone="warning" icon={<ShieldAlert />} title="This plan is on hold">Please contact support so we can help resolve it.</Alert>}

      <Card>
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
          <div className="relative size-28 shrink-0 rounded-[16px] bg-surface-2">
            <ProductImage src={order.productSnapshot.image} alt={order.productSnapshot.name} sizes="112px" className="p-2" />
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="flex flex-wrap gap-2">
              <OrderStatusBadge status={order.orderStatus} />
              <RepaymentStatusBadge status={order.repaymentStatus} />
              <FulfilmentBadge status={order.fulfilmentStatus} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">{order.productSnapshot.name} · {order.productSnapshot.colour}</h1>
            <p className="text-[13px] text-muted">
              {order.orderNumber} · {PURCHASE_MODEL_LABEL[model]} · {order.planSnapshot.name} · terms v{order.agreedTermsVersion}
            </p>
            {model === "pay_small_small" && order.orderStatus !== "completed" && (
              <p className="text-[13px] text-muted">Your iPhone is held securely and released once your plan is fully paid.</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {["submitted", "under_review", "awaiting_deposit"].includes(order.orderStatus) && order.amountPaid === 0 && <CancelOrderButton orderId={orderId} />}
            {order.depositPaidAt && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/account/orders/${orderId}/statement`}><FileText /> {order.outstandingBalance === 0 ? "Settlement statement" : "Statement"}</Link>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {!["submitted", "under_review", "rejected", "cancelled"].includes(order.orderStatus) && (
        <PaymentSummary
          orderId={orderId}
          total={order.agreedPurchasePrice}
          paid={order.amountPaid}
          outstanding={order.outstandingBalance}
          nextAmount={order.nextDueAmount ?? null}
          nextDate={order.nextDueDate ?? null}
          depositPending={!order.depositPaidAt}
          installmentsDone={paidCount}
          installmentsTotal={order.pricing.installmentAmounts.length}
        />
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Repayment schedule</CardTitle>
            </CardHeader>
            <CardContent>
              {installments.length ? (
                <InstallmentTable rows={serialize(installments) as never} graceDays={order.planSnapshot.gracePeriodDays} />
              ) : (
                <div className="space-y-2 text-sm text-muted">
                  <p>Your schedule is created when your deposit is confirmed. Planned installments:</p>
                  <p className="tabular font-medium text-foreground">
                    {order.pricing.installmentAmounts.length} × {formatGHS(order.pricing.installmentAmounts[0] ?? 0)} ({order.planSnapshot.frequency})
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Payments on this order</CardTitle>
              <Link className="text-sm font-medium text-accent hover:underline" href={`/account/payments?order=${orderId}`}>Full history</Link>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-sm text-muted">No payments yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {payments.map((p) => (
                    <li key={p.reference} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium capitalize">{p.kind.replace("_", " ")} <span className="font-mono text-[12px] text-muted normal-case">{p.reference}</span></p>
                        <p className="text-[12.5px] text-muted">{formatDateTime(p.verifiedAt ?? p.createdAt)} {p.channelDetail && `· ${p.channelDetail}`}</p>
                        {p.status === "failed" && <p className="text-[12.5px] text-danger">Not completed — no money was applied. You can try again.</p>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {p.isTest && <SandboxBadge />}
                        <span className="tabular text-sm font-semibold">{formatGHS(p.amount)}</span>
                        <PaymentStatusBadge status={p.status} />
                        {["confirmed", "refunded", "reversed"].includes(p.status) && (
                          <Link className="text-[13px] font-medium text-accent hover:underline" href={`/account/payments/${p.reference}/receipt`}>Receipt</Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <PayPanel
            orderId={orderId}
            depositPaid={!!order.depositPaidAt}
            sandbox={isSandboxMode()}
            options={{
              canPay: opts.canPay && order.orderStatus !== "suspended",
              reason: order.orderStatus === "suspended" ? "Payments are paused while this plan is on hold. Please contact support." : opts.reason,
              depositDue: opts.depositDue,
              outstanding: opts.outstanding,
              allowPartial: opts.allowPartial,
              allowAdditional: opts.allowAdditional,
              nextInstallment: opts.nextInstallment ? { number: opts.nextInstallment.number, amount: opts.nextInstallment.amount, dueDate: opts.nextInstallment.dueDate.toISOString() } : null,
            }}
          />
          {!reviewed && (
            <Card>
              <CardHeader>
                <CardTitle>How was your experience?</CardTitle>
              </CardHeader>
              <CardContent>
                <ReviewForm orderId={orderId} defaultName={actor.name.split(" ")[0]} />
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Your agreement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[
                ["Installment price", formatGHS(order.pricing.basePrice)],
                ...order.pricing.addOns.map((a) => [a.name, formatGHS(a.price)]),
                ...(order.pricing.markup ? [["Financing charge", formatGHS(order.pricing.markup)]] : []),
                ...order.pricing.fees.map((f) => [f.name, formatGHS(f.amount)]),
                ["Total payable", formatGHS(order.agreedPurchasePrice)],
                ["Deposit", formatGHS(order.depositAmount)],
                ["Financed balance", formatGHS(order.pricing.financed)],
                ["Grace period", `${order.planSnapshot.gracePeriodDays} days`],
                ["Applied", formatDate(order.createdAt)],
                ...(order.depositPaidAt ? [["Plan started", formatDate(order.depositPaidAt)]] : []),
                ...(order.collectedAt ? [["Device handed over", formatDate(order.collectedAt)]] : []),
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <span className="text-muted">{k}</span>
                  <span className="tabular text-right font-medium">{v}</span>
                </div>
              ))}
              <details className="pt-2">
                <summary className="cursor-pointer text-[13px] font-medium text-accent">Read full terms</summary>
                <p className="mt-2 text-[12.5px] leading-relaxed whitespace-pre-line text-muted">{order.planSnapshot.termsText}</p>
              </details>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

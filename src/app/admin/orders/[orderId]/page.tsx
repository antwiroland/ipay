import { CheckCircle2, ChevronRight, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fulfilmentAction, orderAction } from "@/app/actions/admin";
import { InstallmentTable } from "@/components/account/installment-table";
import { ActionButton } from "@/components/admin/action-button";
import { ManualPaymentDialog } from "@/components/admin/payment-forms";
import { FulfilmentBadge, OrderStatusBadge, PaymentStatusBadge, RepaymentStatusBadge, SandboxBadge } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { Alert, Card, CardContent, CardHeader, CardTitle, Progress } from "@/components/ui/primitives";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatGHS, progressPercent } from "@/lib/money";
import { isHandedOver, PAYABLE_STATUSES } from "@/lib/order-status";
import { hasPermission } from "@/lib/permissions";
import { PURCHASE_MODEL_LABEL } from "@/lib/pricing";
import { serialize } from "@/lib/utils";
import { User } from "@/models";
import { requireStaffPage } from "@/server/auth/session";
import { presentContact } from "@/server/services/customers";
import { getOrderForActor } from "@/server/services/orders";
import { reconcileOrder } from "@/server/services/payments";

export const metadata = { title: "Order" };

export default async function AdminOrderDetail({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const actor = await requireStaffPage("orders.view", `/admin/orders/${orderId}`);
  const data = await getOrderForActor(actor, orderId).catch(() => null);
  if (!data) notFound();
  const { order, installments, payments } = data;
  const [customer, recon] = await Promise.all([User.findById(order.customerId).lean(), reconcileOrder(orderId)]);
  const contact = customer ? presentContact(actor, customer) : null;
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(actor.role, p);
  const s = order.orderStatus;
  const model = order.planSnapshot.purchaseModel;
  const pct = progressPercent(order.amountPaid, order.agreedPurchasePrice);

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[13px] text-muted">
        <Link href="/admin/orders" className="hover:text-foreground">Orders</Link><ChevronRight className="size-3.5" /><span className="text-foreground">{order.orderNumber}</span>
      </nav>

      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <div className="flex flex-wrap gap-2">
            <OrderStatusBadge status={s} /><RepaymentStatusBadge status={order.repaymentStatus} /><FulfilmentBadge status={order.fulfilmentStatus} />
            <Badge tone="neutral">{PURCHASE_MODEL_LABEL[model]}</Badge>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{order.orderNumber} · {order.productSnapshot.name} ({order.productSnapshot.colour})</h1>
          <p className="text-sm text-muted">
            <Link className="text-accent hover:underline" href={`/admin/customers/${order.customerId}`}>{customer?.name}</Link> · {contact?.phone} · verification <strong>{customer?.verificationStatus}</strong>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can("orders.review") && s === "submitted" && <ActionButton label="Start review" action={orderAction.bind(null, orderId, "review")} />}
          {can("orders.review") && (s === "submitted" || s === "under_review") && (
            <>
              <ActionButton variant="primary" label="Approve" action={orderAction.bind(null, orderId, "approve")} confirm={{ title: "Approve this application?", description: order.planSnapshot.requiresVerification ? "The customer's identity must already be verified." : undefined }} reason="optional" reasonLabel="Note" />
              <ActionButton danger label="Reject" action={orderAction.bind(null, orderId, "reject")} confirm={{ title: "Reject application", description: "The customer will see this reason. Stock is released." }} reason="required" />
            </>
          )}
          {can("orders.fulfil") && order.depositPaidAt && !isHandedOver(order.fulfilmentStatus) && !["completed", "cancelled", "rejected", "suspended"].includes(s) && (
            <>
              {order.fulfilmentStatus === "not_prepared" && <ActionButton label="Mark preparing" action={fulfilmentAction.bind(null, orderId, "preparing")} />}
              {order.fulfilmentStatus !== "ready_for_collection" && <ActionButton label="Ready for collection" action={fulfilmentAction.bind(null, orderId, "ready_for_collection")} />}
              {(model === "take_and_pay" || order.outstandingBalance === 0) && (
                <>
                  <ActionButton variant="primary" label="Record collection" action={fulfilmentAction.bind(null, orderId, "collected")} confirm={{ title: "Record device collection", description: "Confirm you checked the customer's original ID." }} reason="optional" reasonLabel="Collection note (store, IMEI…)" />
                  <ActionButton label="Record delivery" action={fulfilmentAction.bind(null, orderId, "delivered")} confirm={{ title: "Record delivery" }} reason="optional" reasonLabel="Delivery note" />
                </>
              )}
            </>
          )}
          {can("orders.manage") && s === "fully_paid" && isHandedOver(order.fulfilmentStatus) && <ActionButton variant="primary" label="Mark completed" action={orderAction.bind(null, orderId, "complete")} />}
          {can("orders.manage") && ["awaiting_collection", "active_repayment", "fully_paid"].includes(s) && <ActionButton label="Suspend" action={orderAction.bind(null, orderId, "suspend")} reason="required" confirm={{ title: "Suspend order" }} />}
          {can("orders.manage") && s === "suspended" && <ActionButton label="Resume" action={orderAction.bind(null, orderId, "resume")} reason="required" confirm={{ title: "Resume order" }} />}
          {can("orders.manage") && ["submitted", "under_review", "awaiting_deposit", "awaiting_collection", "active_repayment"].includes(s) && (
            <ActionButton danger label="Cancel" action={orderAction.bind(null, orderId, "cancel")} reason="required" confirm={{ title: "Cancel order", description: "Only possible when there are no net confirmed payments. Refund first if needed." }} />
          )}
        </div>
      </div>

      {order.rejectionReason && <Alert tone="danger" title="Rejection reason">{order.rejectionReason}</Alert>}
      {recon.ok ? (
        <Alert tone="success" icon={<CheckCircle2 />}>Ledger reconciled: {formatGHS(recon.ledgerTotal)} in the ledger matches allocations and the order balance.</Alert>
      ) : (
        <Alert tone="danger" icon={<ShieldAlert />} title="Reconciliation discrepancy">{recon.issues.join(" · ")}</Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Contract price", formatGHS(order.agreedPurchasePrice)],
          ["Confirmed paid", formatGHS(order.amountPaid)],
          ["Outstanding", formatGHS(order.outstandingBalance)],
          ["Next due", order.outstandingBalance && order.nextDueDate ? `${formatGHS(order.nextDueAmount ?? 0)} · ${formatDate(order.nextDueDate)}` : "—"],
        ].map(([k, v]) => (
          <Card key={k} className="p-4"><p className="text-[12.5px] text-muted">{k}</p><p className="tabular mt-1 text-lg font-semibold">{v}</p></Card>
        ))}
      </div>
      <Progress value={pct} label="Payment progress" />

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Installment schedule</CardTitle></CardHeader>
            <CardContent>
              {installments.length ? <InstallmentTable rows={serialize(installments) as never} graceDays={order.planSnapshot.gracePeriodDays} /> : <p className="text-sm text-muted">Created when the deposit is confirmed.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Payments</CardTitle>
              {can("payments.manual") && PAYABLE_STATUSES.includes(s) && <ManualPaymentDialog orderId={orderId} max={order.outstandingBalance} />}
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? <p className="text-sm text-muted">No payments yet.</p> : (
                <ul className="divide-y divide-border">
                  {payments.map((p) => (
                    <li key={p.reference} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <div>
                        <Link href={`/admin/payments/${p._id}`} className="font-mono text-[12.5px] text-accent hover:underline">{p.reference}</Link>
                        <p className="text-[12px] text-muted capitalize">{p.kind.replace("_", " ")} · {p.provider} · {formatDateTime(p.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.isTest && <SandboxBadge />}
                        <span className="tabular text-sm font-medium">{formatGHS(p.amount)}</span>
                        <PaymentStatusBadge status={p.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Contract snapshot</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              {[
                ["Plan", `${order.planSnapshot.name} (${order.planSnapshot.code})`],
                ["Terms version", order.agreedTermsVersion],
                ["Accepted", formatDateTime(order.termsAcceptedAt)],
                ["Installment price", formatGHS(order.pricing.basePrice) + (order.pricing.promoApplied ? " (offer)" : "")],
                ["Add-ons", formatGHS(order.pricing.addOnsTotal)],
                ["Financing charge", formatGHS(order.pricing.markup)],
                ["Fees", formatGHS(order.pricing.feesTotal)],
                ["Deposit", formatGHS(order.depositAmount)],
                ["Financed", formatGHS(order.pricing.financed)],
                ["Schedule", `${order.pricing.installmentAmounts.length} × ${order.planSnapshot.frequency}`],
                ...(can("reports.view") ? [["Cost of device", formatGHS(order.costPriceSnapshot)]] : []),
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3"><span className="text-muted">{k}</span><span className="tabular text-right font-medium">{v}</span></div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Status history</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-3 border-l border-border pl-4">
                {[...order.statusHistory].reverse().map((h, i) => (
                  <li key={i} className="relative text-sm">
                    <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-surface bg-accent" />
                    <p className="font-medium">{h.status.replace("fulfilment:", "Fulfilment → ").replace(/_/g, " ")}</p>
                    <p className="text-[12px] text-muted">{formatDateTime(h.at)}{h.note ? ` · ${h.note}` : ""}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

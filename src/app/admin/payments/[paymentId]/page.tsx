import { ChevronRight } from "lucide-react";
import { Types } from "mongoose";
import Link from "next/link";
import { notFound } from "next/navigation";
import { reconcileAction, reverifyAction } from "@/app/actions/admin";
import { ActionButton } from "@/components/admin/action-button";
import { RefundDialog } from "@/components/admin/payment-forms";
import { PaymentStatusBadge, SandboxBadge } from "@/components/status-badges";
import { Alert, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/dates";
import { formatGHS } from "@/lib/money";
import { hasPermission } from "@/lib/permissions";
import { AuditLog, Payment, PaymentAllocation, Refund, User } from "@/models";
import { requireStaffPage } from "@/server/auth/session";

export const metadata = { title: "Payment" };

export default async function AdminPaymentDetail({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const actor = await requireStaffPage("payments.view", `/admin/payments/${paymentId}`);
  if (!Types.ObjectId.isValid(paymentId)) notFound();
  const p = await Payment.findById(paymentId).lean();
  if (!p) notFound();
  const [customer, allocations, refunds, history, recorder] = await Promise.all([
    User.findById(p.customerId).select("name").lean(),
    PaymentAllocation.find({ paymentId: p._id }).sort({ createdAt: 1 }).lean(),
    Refund.find({ paymentId: p._id }).sort({ createdAt: -1 }).populate("createdBy", "name").lean(),
    AuditLog.find({ resourceType: "Payment", resourceId: p._id.toString() }).sort({ timestamp: -1 }).populate("actorId", "name").lean(),
    p.recordedBy ? User.findById(p.recordedBy).select("name").lean() : null,
  ]);
  const can = (x: Parameters<typeof hasPermission>[1]) => hasPermission(actor.role, x);
  const refundable = p.amount - p.refundedAmount;
  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[13px] text-muted">
        <Link href="/admin/payments" className="hover:text-foreground">Payments</Link><ChevronRight className="size-3.5" /><span className="font-mono text-foreground">{p.reference}</span>
      </nav>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex gap-2"><PaymentStatusBadge status={p.status} />{p.isTest && <SandboxBadge />}</div>
          <h1 className="tabular mt-2 text-3xl font-semibold">{formatGHS(p.amount)}</h1>
          <p className="text-sm text-muted">{customer?.name} · <Link className="text-accent hover:underline" href={`/admin/orders/${p.orderId}`}>{p.orderNumber}</Link></p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can("payments.reconcile") && p.provider !== "manual" && ["pending", "processing", "expired", "failed"].includes(p.status) && <ActionButton label="Re-verify with provider" action={reverifyAction.bind(null, paymentId)} />}
          {can("payments.reconcile") && p.reconciliationStatus === "needs_review" && p.unallocatedAmount === 0 && <ActionButton label="Mark resolved" action={reconcileAction.bind(null, paymentId)} reason="required" reasonLabel="Resolution note" confirm={{ title: "Resolve reconciliation" }} />}
          {can("payments.refund") && ["confirmed", "refunded", "reversed"].includes(p.status) && refundable > 0 && <RefundDialog paymentId={paymentId} refundable={refundable} />}
        </div>
      </div>
      {p.reconciliationStatus === "needs_review" && (
        <Alert tone="danger" title="Needs review">
          {p.unallocatedAmount > 0 ? `${formatGHS(p.unallocatedAmount)} exceeded the order balance and is held unallocated — refund it to the customer.` : p.failureReason}
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Transaction</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {[
              ["Reference", p.reference],
              ["Provider reference", p.providerReference ?? "—"],
              ["Provider", p.provider],
              ["Method", p.channelDetail || p.method || "—"],
              ["Type", p.kind.replace("_", " ")],
              ["Currency", p.currency],
              ["Created", formatDateTime(p.createdAt)],
              ["Verified", formatDateTime(p.verifiedAt)],
              ["Applied to balance", formatGHS(p.allocatedAmount)],
              ["Unallocated", formatGHS(p.unallocatedAmount)],
              ["Refunded / reversed", formatGHS(p.refundedAmount)],
              ["Reconciliation", p.reconciliationStatus.replace("_", " ")],
              ...(p.provider === "manual" ? [["Recorded by", recorder?.name ?? "—"], ["Reason", p.manualReason ?? "—"]] : []),
              ...(p.failureReason ? [["Provider message", p.failureReason]] : []),
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4"><span className="text-muted">{k}</span><span className="text-right font-medium break-all">{v}</span></div>
            ))}
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Allocations</CardTitle></CardHeader>
            <CardContent>
              {allocations.length === 0 ? <p className="text-sm text-muted">Not allocated.</p> : (
                <ul className="space-y-1.5 text-sm">
                  {allocations.map((a) => (
                    <li key={a._id.toString()} className="flex justify-between">
                      <span className="text-muted">{a.installmentNumber === 0 ? "Deposit" : `Installment ${a.installmentNumber}`}{a.refundId ? " (refund unwind)" : ""}</span>
                      <span className={`tabular font-medium ${a.amount < 0 ? "text-danger" : ""}`}>{formatGHS(a.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Refunds & reversals</CardTitle></CardHeader>
            <CardContent>
              {refunds.length === 0 ? <p className="text-sm text-muted">None.</p> : (
                <ul className="space-y-3 text-sm">
                  {refunds.map((r) => (
                    <li key={r._id.toString()}>
                      <p className="font-medium capitalize">{r.type} · <span className="tabular">{formatGHS(r.amount)}</span></p>
                      <p className="text-[12.5px] text-muted">{formatDateTime(r.createdAt)} by {(r.createdBy as unknown as { name?: string })?.name} — {r.reason}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Audit trail</CardTitle></CardHeader>
            <CardContent>
              {history.length === 0 ? <p className="text-sm text-muted">No staff actions.</p> : (
                <ul className="space-y-2 text-[13px]">
                  {history.map((h) => (
                    <li key={h._id.toString()}><span className="font-medium">{h.action}</span> · {(h.actorId as unknown as { name?: string })?.name ?? "System"} · <span className="text-muted">{formatDateTime(h.timestamp)}</span>{h.reason && <span className="text-muted"> — {h.reason}</span>}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

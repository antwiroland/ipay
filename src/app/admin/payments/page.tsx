import Link from "next/link";
import { exportUrl, FilterBar, Pager } from "@/components/admin/list-controls";
import { PaymentStatusBadge, SandboxBadge } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { PageHeader, StatCard } from "@/components/ui/primitives";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { formatGHS } from "@/lib/money";
import { PAYMENT_STATUS_LABEL, PAYMENT_STATUSES } from "@/lib/order-status";
import { hasPermission } from "@/lib/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { listPayments } from "@/server/services/admin-queries";

export const metadata = { title: "Payments" };

export default async function AdminPayments({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireStaffPage("payments.view", "/admin/payments");
  const sp = await searchParams;
  const { items, total, page, sums } = await listPayments(actor, sp);
  const sum = (s: string[]) => sums.filter((x) => s.includes(x._id)).reduce((a, x) => a + x.amount, 0);
  return (
    <div>
      <PageHeader title="Payments" description="Every transaction, as reported and verified with the payment provider." />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Confirmed (filtered)" value={formatGHS(sum(["confirmed"]))} tone="success" />
        <StatCard label="Pending / processing" value={formatGHS(sum(["pending", "processing"]))} hint="Not applied to balances" />
        <StatCard label="Failed / expired" value={formatGHS(sum(["failed", "expired"]))} hint="Never applied" />
      </div>
      <FilterBar
        values={sp}
        exportHref={hasPermission(actor.role, "payments.export") ? exportUrl("payments", sp) : undefined}
        fields={[
          { type: "search", name: "q", placeholder: "Reference, order, customer" },
          { type: "select", name: "status", label: "Status", options: PAYMENT_STATUSES.map((s) => ({ value: s, label: PAYMENT_STATUS_LABEL[s] })) },
          { type: "select", name: "recon", label: "Reconciliation", options: ["unreconciled", "matched", "needs_review", "resolved"].map((v) => ({ value: v, label: v.replace("_", " ") })) },
          { type: "select", name: "provider", label: "Provider", options: ["paystack", "mock", "manual"].map((v) => ({ value: v, label: v })) },
          { type: "select", name: "kind", label: "Type", options: ["deposit", "installment", "additional", "full_balance", "manual"].map((v) => ({ value: v, label: v.replace("_", " ") })) },
          { type: "date", name: "from", label: "From" },
          { type: "date", name: "to", label: "To" },
        ]}
      />
      <Table className="min-w-[1100px]">
        <THead>
          <tr>
            <TH>Reference</TH><TH>Customer</TH><TH>Order</TH><TH>Type</TH><TH className="text-right">Amount</TH><TH>Currency</TH><TH>Provider</TH><TH>Method</TH><TH>Timestamp</TH><TH>Status</TH><TH>Reconciliation</TH>
          </tr>
        </THead>
        <TBody>
          {items.length === 0 && <tr><TD colSpan={11} className="py-10 text-center text-muted">No payments match these filters.</TD></tr>}
          {items.map((p) => (
            <TR key={p.reference}>
              <TD><Link className="font-mono text-[12.5px] text-accent hover:underline" href={`/admin/payments/${p._id}`}>{p.reference}</Link> {p.isTest && <SandboxBadge />}</TD>
              <TD>{p.customer?.name}</TD>
              <TD><Link className="hover:underline" href={`/admin/orders/${p.orderId}`}>{p.orderNumber}</Link></TD>
              <TD className="capitalize">{p.kind.replace("_", " ")}</TD>
              <TD className="tabular text-right font-medium">{formatGHS(p.amount)}</TD>
              <TD>{p.currency}</TD>
              <TD className="capitalize">{p.provider}</TD>
              <TD className="text-muted">{p.channelDetail || p.method || "—"}</TD>
              <TD className="text-muted">{formatDateTime(p.verifiedAt ?? p.createdAt)}</TD>
              <TD><PaymentStatusBadge status={p.status} /></TD>
              <TD><Badge tone={p.reconciliationStatus === "needs_review" ? "danger" : p.reconciliationStatus === "matched" || p.reconciliationStatus === "resolved" ? "success" : "neutral"}>{p.reconciliationStatus.replace("_", " ")}</Badge></TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <Pager page={page} pageSize={25} total={total} params={sp} />
    </div>
  );
}

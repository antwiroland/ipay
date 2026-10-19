import Link from "next/link";
import { exportUrl, FilterBar, Pager } from "@/components/admin/list-controls";
import { InstallmentStatusBadge } from "@/components/status-badges";
import { PageHeader } from "@/components/ui/primitives";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate } from "@/lib/dates";
import { formatGHS } from "@/lib/money";
import { hasPermission } from "@/lib/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { listInstallments } from "@/server/services/admin-queries";

export const metadata = { title: "Repayment tracking" };

export default async function RepaymentTracking({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireStaffPage("installments.view", "/admin/installments");
  const sp = await searchParams;
  const { items, total, page } = await listInstallments(actor, sp);
  return (
    <div>
      <PageHeader title="Repayment tracking" description="Every installment across all plans. Statuses are computed from confirmed payments and due dates." />
      <div className="mb-4 flex flex-wrap gap-3 text-[12.5px] text-muted">
        {[["#12804a", "Paid"], ["#2563eb", "Upcoming"], ["#b45309", "Due soon"], ["#c8311f", "Overdue"], ["#8a93a3", "Cancelled"]].map(([c, l]) => (
          <span key={l} className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: c }} />{l}</span>
        ))}
      </div>
      <FilterBar
        values={sp}
        exportHref={hasPermission(actor.role, "reports.export") ? exportUrl("installments", sp) : undefined}
        fields={[
          { type: "search", name: "q", placeholder: "Customer or order #" },
          { type: "search", name: "product", placeholder: "Product" },
          { type: "select", name: "status", label: "Status", options: [["upcoming", "Upcoming"], ["due", "Due soon"], ["partially_paid", "Partially paid"], ["overdue", "Overdue"], ["paid", "Paid"], ["cancelled", "Cancelled"]].map(([value, label]) => ({ value, label })) },
          { type: "select", name: "completion", label: "Order", options: [{ value: "active", label: "Active orders" }, { value: "completed", label: "Completed orders" }] },
          { type: "select", name: "minOverdue", label: "Min outstanding", options: [["100", "≥ GH₵100"], ["500", "≥ GH₵500"], ["1000", "≥ GH₵1,000"]].map(([value, label]) => ({ value, label })) },
          { type: "date", name: "dueFrom", label: "Due from" },
          { type: "date", name: "dueTo", label: "Due to" },
        ]}
      />
      <Table className="min-w-[1200px]">
        <THead>
          <tr>
            <TH>Customer</TH><TH>Order</TH><TH>Product</TH><TH>#</TH><TH>Due date</TH><TH className="text-right">Amount due</TH><TH className="text-right">Paid</TH><TH className="text-right">Remaining</TH><TH className="text-right">Order balance</TH><TH>Status</TH><TH>Last payment</TH><TH>Next action</TH>
          </tr>
        </THead>
        <TBody>
          {items.length === 0 && <tr><TD colSpan={12} className="py-10 text-center text-muted">No installments match these filters.</TD></tr>}
          {items.map((r) => (
            <TR key={r._id.toString()} className={r.live === "overdue" ? "bg-danger-soft/40" : undefined}>
              <TD>{r.customer ? <Link className="hover:underline" href={`/admin/customers/${r.customerId}`}>{r.customer.name}</Link> : "—"}</TD>
              <TD><Link className="text-accent hover:underline" href={`/admin/orders/${r.orderId}`}>{r.orderNumber}</Link></TD>
              <TD>{r.order?.productSnapshot?.name}</TD>
              <TD className="tabular">{r.installmentNumber}</TD>
              <TD>{formatDate(r.dueDate)}</TD>
              <TD className="tabular text-right">{formatGHS(r.amountDue)}</TD>
              <TD className="tabular text-right">{formatGHS(r.amountPaid)}</TD>
              <TD className="tabular text-right font-medium">{formatGHS(r.outstandingAmount)}</TD>
              <TD className="tabular text-right">{r.order ? formatGHS(r.order.outstandingBalance) : "—"}</TD>
              <TD><InstallmentStatusBadge status={r.live} /></TD>
              <TD className="text-muted">{r.lastPaymentAt ? formatDate(r.lastPaymentAt) : "—"}</TD>
              <TD className="text-muted">{r.nextAction}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <Pager page={page} pageSize={30} total={total} params={sp} />
    </div>
  );
}

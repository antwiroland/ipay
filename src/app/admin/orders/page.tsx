import Link from "next/link";
import { exportUrl, FilterBar, Pager } from "@/components/admin/list-controls";
import { FulfilmentBadge, OrderStatusBadge, RepaymentStatusBadge } from "@/components/status-badges";
import { PageHeader } from "@/components/ui/primitives";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate } from "@/lib/dates";
import { formatGHS } from "@/lib/money";
import { FULFILMENT_LABEL, ORDER_STATUS_LABEL, ORDER_STATUSES, REPAYMENT_LABEL, FULFILMENT_STATUSES } from "@/lib/order-status";
import { hasPermission } from "@/lib/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { listOrders } from "@/server/services/admin-queries";

export const metadata = { title: "Orders" };

export default async function AdminOrders({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireStaffPage("orders.view", "/admin/orders");
  const sp = await searchParams;
  const { items, total, page } = await listOrders(actor, sp);
  return (
    <div>
      <PageHeader title="Orders" description="Installment applications and contracts." />
      <FilterBar
        values={sp}
        exportHref={hasPermission(actor.role, "reports.export") ? exportUrl("orders", sp) : undefined}
        fields={[
          { type: "search", name: "q", placeholder: "Order #, customer, product" },
          { type: "select", name: "status", label: "Status", options: [{ value: "active", label: "All active" }, ...ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_LABEL[s] }))] },
          { type: "select", name: "repayment", label: "Repayment", options: Object.entries(REPAYMENT_LABEL).map(([value, label]) => ({ value, label })) },
          { type: "select", name: "fulfilment", label: "Fulfilment", options: FULFILMENT_STATUSES.map((s) => ({ value: s, label: FULFILMENT_LABEL[s] })) },
          { type: "select", name: "model", label: "Model", options: [{ value: "take_and_pay", label: "Take & Pay" }, { value: "pay_small_small", label: "Pay Small-Small" }] },
          { type: "date", name: "from", label: "Applied from" },
          { type: "date", name: "to", label: "to" },
        ]}
      />
      <Table className="min-w-[1100px]">
        <THead>
          <tr>
            <TH>Order</TH>
            <TH>Customer</TH>
            <TH>Product</TH>
            <TH className="text-right">Contract</TH>
            <TH className="text-right">Deposit</TH>
            <TH className="text-right">Paid</TH>
            <TH className="text-right">Outstanding</TH>
            <TH>Applied</TH>
            <TH>Next due</TH>
            <TH>Status</TH>
            <TH>Repayment</TH>
            <TH>Fulfilment</TH>
          </tr>
        </THead>
        <TBody>
          {items.length === 0 && (
            <tr><TD colSpan={12} className="py-10 text-center text-muted">No orders match these filters.</TD></tr>
          )}
          {items.map((o) => (
            <TR key={o._id.toString()}>
              <TD><Link href={`/admin/orders/${o._id}`} className="font-medium text-accent hover:underline">{o.orderNumber}</Link></TD>
              <TD>
                <Link href={`/admin/customers/${o.customerId}`} className="hover:underline">{o.customer?.name}</Link>
                <p className="text-[12px] text-muted">{o.customer?.phone}</p>
              </TD>
              <TD>{o.productSnapshot.name}</TD>
              <TD className="tabular text-right">{formatGHS(o.agreedPurchasePrice)}</TD>
              <TD className="tabular text-right">{formatGHS(o.depositAmount)}</TD>
              <TD className="tabular text-right">{formatGHS(o.amountPaid)}</TD>
              <TD className="tabular text-right font-medium">{formatGHS(o.outstandingBalance)}</TD>
              <TD className="text-muted">{formatDate(o.createdAt)}</TD>
              <TD className="text-muted">{o.outstandingBalance > 0 && o.nextDueDate ? formatDate(o.nextDueDate) : "—"}</TD>
              <TD><OrderStatusBadge status={o.orderStatus} /></TD>
              <TD><RepaymentStatusBadge status={o.repaymentStatus} /></TD>
              <TD><FulfilmentBadge status={o.fulfilmentStatus} /></TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <Pager page={page} pageSize={20} total={total} params={sp} />
    </div>
  );
}

import Link from "next/link";
import { exportUrl, FilterBar, Pager } from "@/components/admin/list-controls";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/primitives";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate } from "@/lib/dates";
import { formatGHS } from "@/lib/money";
import { hasPermission } from "@/lib/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { listCustomers } from "@/server/services/customers";

export const metadata = { title: "Customers" };
const VT = { unverified: "grey", pending: "warning", verified: "success", rejected: "danger" } as const;

export default async function AdminCustomers({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireStaffPage("customers.view", "/admin/customers");
  const sp = await searchParams;
  const { items, total, page, pageSize } = await listCustomers(actor, { q: sp.q, verification: sp.verification, status: sp.status, hasActive: sp.active, page: Number(sp.page) || 1 });
  return (
    <div>
      <PageHeader title="Customers" description={items[0]?.masked ? "Contact details are masked for your role." : undefined} />
      <FilterBar
        values={sp}
        exportHref={hasPermission(actor.role, "reports.export") && hasPermission(actor.role, "customers.pii") ? exportUrl("customers", sp) : undefined}
        fields={[
          { type: "search", name: "q", placeholder: "Name, email or phone" },
          { type: "select", name: "verification", label: "Verification", options: ["unverified", "pending", "verified", "rejected"].map((v) => ({ value: v, label: v })) },
          { type: "select", name: "status", label: "Account", options: [{ value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }] },
          { type: "select", name: "active", label: "Active order", options: [{ value: "yes", label: "Has active order" }, { value: "no", label: "No active order" }] },
        ]}
      />
      <Table className="min-w-[1000px]">
        <THead>
          <tr><TH>Customer ID</TH><TH>Name</TH><TH>Phone</TH><TH>Email</TH><TH>Registered</TH><TH>Verification</TH><TH>Account</TH><TH>Active order</TH><TH className="text-right">Total paid</TH><TH className="text-right">Outstanding</TH></tr>
        </THead>
        <TBody>
          {items.length === 0 && <tr><TD colSpan={10} className="py-10 text-center text-muted">No customers found.</TD></tr>}
          {items.map((c) => (
            <TR key={c.id}>
              <TD className="font-mono text-[12px] text-muted">{c.id.slice(-8).toUpperCase()}</TD>
              <TD><Link href={`/admin/customers/${c.id}`} className="font-medium text-accent hover:underline">{c.name}</Link></TD>
              <TD>{c.phone}</TD>
              <TD>{c.email}</TD>
              <TD className="text-muted">{formatDate(c.createdAt)}</TD>
              <TD><Badge tone={VT[c.verificationStatus]} dot>{c.verificationStatus}</Badge></TD>
              <TD><Badge tone={c.accountStatus === "active" ? "success" : "danger"}>{c.accountStatus}</Badge></TD>
              <TD>{c.activeOrder ? <Link className="hover:underline" href={`/admin/orders/${c.activeOrder.id}`}>{c.activeOrder.orderNumber}</Link> : <span className="text-subtle">—</span>}</TD>
              <TD className="tabular text-right">{formatGHS(c.totalPaid)}</TD>
              <TD className="tabular text-right font-medium">{formatGHS(c.outstanding)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <Pager page={page} pageSize={pageSize} total={total} params={sp} />
    </div>
  );
}

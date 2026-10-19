import { FilterBar, Pager } from "@/components/admin/list-controls";
import { PageHeader } from "@/components/ui/primitives";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { requireStaffPage } from "@/server/auth/session";
import { listAudit } from "@/server/services/admin-queries";

export const metadata = { title: "Audit logs" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireStaffPage("audit.view", "/admin/audit-logs");
  const sp = await searchParams;
  const { items, total, page } = await listAudit(actor, sp);
  return (
    <div>
      <PageHeader title="Audit logs" description="Append-only record of administrative and financial events. Entries cannot be edited or deleted from the application." />
      <FilterBar
        values={sp}
        fields={[
          { type: "search", name: "action", placeholder: "Action prefix, e.g. payment." },
          { type: "select", name: "resource", label: "Resource", options: ["Order", "Payment", "Product", "PaymentPlan", "Promotion", "User", "Setting", "Export", "System"].map((v) => ({ value: v, label: v })) },
          { type: "search", name: "resourceId", placeholder: "Resource ID" },
          { type: "date", name: "from", label: "From" },
          { type: "date", name: "to", label: "To" },
        ]}
      />
      <Table className="min-w-[1000px]">
        <THead><tr><TH>Time</TH><TH>Actor</TH><TH>Role</TH><TH>Action</TH><TH>Resource</TH><TH>Reason</TH><TH>Details</TH></tr></THead>
        <TBody>
          {items.length === 0 && <tr><TD colSpan={7} className="py-8 text-center text-muted">No entries.</TD></tr>}
          {items.map((a) => (
            <TR key={a._id.toString()}>
              <TD className="text-muted">{formatDateTime(a.timestamp)}</TD>
              <TD>{(a.actorId as unknown as { name?: string })?.name ?? "System"}</TD>
              <TD className="text-muted">{a.actorRole ?? "—"}</TD>
              <TD className="font-mono text-[12px]">{a.action}</TD>
              <TD className="text-[12.5px]">{a.resourceType}<span className="block font-mono text-[11px] text-muted">{a.resourceId}</span></TD>
              <TD className="max-w-xs truncate whitespace-normal">{a.reason ?? "—"}</TD>
              <TD className="max-w-sm truncate font-mono text-[11px] text-muted" title={a.metadata ? JSON.stringify(a.metadata) : undefined}>{a.metadata ? JSON.stringify(a.metadata) : "—"}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <Pager page={page} pageSize={40} total={total} params={sp} />
    </div>
  );
}

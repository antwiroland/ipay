import { InstallmentStatusBadge } from "@/components/status-badges";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { deriveInstallmentStatus } from "@/lib/allocation";
import { formatDate } from "@/lib/dates";
import { formatGHS } from "@/lib/money";

export interface InstallmentRow {
  _id: string;
  installmentNumber: number;
  dueDate: string | Date;
  amountDue: number;
  amountPaid: number;
  outstandingAmount: number;
  status: string;
  paidAt?: string | Date | null;
  lastPaymentReference?: string | null;
}

export function InstallmentTable({ rows, graceDays, now = new Date() }: { rows: InstallmentRow[]; graceDays: number; now?: Date }) {
  const withStatus = rows.map((r) => ({
    ...r,
    live: r.status === "cancelled" ? "cancelled" : deriveInstallmentStatus({ amountDue: r.amountDue, amountPaid: r.amountPaid, dueDate: new Date(r.dueDate) }, now, graceDays),
  }));
  return (
    <>
      {/* Mobile: timeline cards */}
      <ol className="space-y-2 md:hidden">
        {withStatus.map((r) => (
          <li key={r._id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-[14px] border border-border bg-surface p-3.5">
            <div>
              <p className="text-sm font-medium">#{r.installmentNumber} · {formatDate(r.dueDate)}</p>
              <p className="tabular text-[12.5px] text-muted">
                {formatGHS(r.amountPaid)} of {formatGHS(r.amountDue)} paid
              </p>
            </div>
            <InstallmentStatusBadge status={r.live} />
          </li>
        ))}
      </ol>
      {/* Desktop: table */}
      <div className="hidden md:block">
        <Table>
          <THead>
            <tr>
              <TH>#</TH>
              <TH>Due date</TH>
              <TH className="text-right">Scheduled</TH>
              <TH className="text-right">Paid</TH>
              <TH className="text-right">Outstanding</TH>
              <TH>Status</TH>
              <TH>Confirmed</TH>
              <TH>Reference</TH>
            </tr>
          </THead>
          <TBody>
            {withStatus.map((r) => (
              <TR key={r._id}>
                <TD className="tabular font-medium">{r.installmentNumber}</TD>
                <TD>{formatDate(r.dueDate)}</TD>
                <TD className="tabular text-right">{formatGHS(r.amountDue)}</TD>
                <TD className="tabular text-right">{formatGHS(r.amountPaid)}</TD>
                <TD className="tabular text-right">{formatGHS(r.outstandingAmount)}</TD>
                <TD><InstallmentStatusBadge status={r.live} /></TD>
                <TD className="text-muted">{r.paidAt ? formatDate(r.paidAt) : "—"}</TD>
                <TD className="font-mono text-[12px] text-muted">{r.lastPaymentReference ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </>
  );
}

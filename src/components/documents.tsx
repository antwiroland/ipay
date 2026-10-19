import { LogoMark } from "@/components/brand";
import { SandboxBadge } from "@/components/status-badges";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatGHS } from "@/lib/money";
import type { IOrder, IPayment, IInstallment, ISetting } from "@/models";

export function DocHeader({ title, subtitle, settings }: { title: string; subtitle: string; settings: ISetting }) {
  return (
    <div className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-start">
      <div className="flex items-center gap-3">
        <LogoMark className="size-10" />
        <div>
          <p className="font-semibold">iPay Ghana</p>
          <p className="text-[12.5px] text-muted">{settings.storeAddress} · {settings.supportPhone} · {settings.supportEmail}</p>
        </div>
      </div>
      <div className="sm:text-right">
        <p className="text-lg font-semibold tracking-tight">{title}</p>
        <p className="text-[12.5px] text-muted">{subtitle}</p>
      </div>
    </div>
  );
}

export function Receipt({ payment, order, customer, settings }: { payment: IPayment; order: IOrder; customer: { name: string; email: string; phone: string }; settings: ISetting }) {
  const rows: [string, string][] = [
    ["Receipt for", customer.name],
    ["Order", `${order.orderNumber} · ${order.productSnapshot.name}`],
    ["Payment type", payment.kind.replace("_", " ")],
    ["Payment method", payment.channelDetail || payment.method || payment.provider],
    ["Transaction reference", payment.reference],
    ["Provider reference", payment.providerReference ?? "—"],
    ["Confirmed", formatDateTime(payment.verifiedAt)],
    ["Status", payment.status],
  ];
  return (
    <article className="mx-auto max-w-2xl rounded-[18px] border border-border bg-surface p-6 sm:p-10 print:border-0 print:p-0">
      <DocHeader title="Payment receipt" subtitle={`Issued ${formatDate(new Date())}`} settings={settings} />
      {payment.isTest && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-warning-soft p-3 text-[13px] text-warning">
          <SandboxBadge /> Sandbox transaction — not a real payment.
        </div>
      )}
      <div className="py-8 text-center">
        <p className="text-[13px] text-muted">Amount paid</p>
        <p className="tabular mt-1 text-4xl font-semibold tracking-tight">{formatGHS(payment.amount)}</p>
        {payment.refundedAmount > 0 && <p className="tabular mt-1 text-sm text-danger">Refunded/reversed: {formatGHS(payment.refundedAmount)}</p>}
      </div>
      <dl className="divide-y divide-border text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-2.5">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right font-medium capitalize">{v}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 py-2.5">
          <dt className="text-muted">Applied to balance</dt>
          <dd className="tabular font-medium">{formatGHS(payment.allocatedAmount)}</dd>
        </div>
        {payment.unallocatedAmount > 0 && (
          <div className="flex justify-between gap-4 py-2.5">
            <dt className="text-muted">Held for refund (exceeded balance)</dt>
            <dd className="tabular font-medium">{formatGHS(payment.unallocatedAmount)}</dd>
          </div>
        )}
      </dl>
      <p className="mt-8 text-[12px] text-subtle">Keep this receipt for your records. Questions? Contact {settings.supportEmail}.</p>
    </article>
  );
}

export function Statement({
  order,
  installments,
  payments,
  customer,
  settings,
}: {
  order: IOrder;
  installments: IInstallment[];
  payments: IPayment[];
  customer: { name: string; email: string; phone: string };
  settings: ISetting;
}) {
  const settled = order.outstandingBalance === 0;
  return (
    <article className="mx-auto max-w-3xl rounded-[18px] border border-border bg-surface p-6 sm:p-10 print:border-0 print:p-0">
      <DocHeader title={settled ? "Final settlement statement" : "Account statement"} subtitle={`${order.orderNumber} · generated ${formatDate(new Date())}`} settings={settings} />
      <div className="mt-6 grid gap-6 text-sm sm:grid-cols-2">
        <div>
          <p className="text-[12px] font-medium tracking-wide text-muted uppercase">Customer</p>
          <p className="mt-1 font-medium">{customer.name}</p>
          <p className="text-muted">{customer.email}</p>
          <p className="text-muted">{customer.phone}</p>
        </div>
        <div>
          <p className="text-[12px] font-medium tracking-wide text-muted uppercase">Device & plan</p>
          <p className="mt-1 font-medium">{order.productSnapshot.name} · {order.productSnapshot.colour}</p>
          <p className="text-muted">{order.planSnapshot.name} (terms v{order.agreedTermsVersion})</p>
          <p className="text-muted">Started {formatDate(order.depositPaidAt)}{order.completedAt ? ` · completed ${formatDate(order.completedAt)}` : ""}</p>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3 rounded-[14px] bg-surface-2 p-4 text-center">
        <div>
          <p className="text-[12px] text-muted">Agreed price</p>
          <p className="tabular font-semibold">{formatGHS(order.agreedPurchasePrice)}</p>
        </div>
        <div>
          <p className="text-[12px] text-muted">Total paid</p>
          <p className="tabular font-semibold">{formatGHS(order.amountPaid)}</p>
        </div>
        <div>
          <p className="text-[12px] text-muted">Outstanding</p>
          <p className={`tabular font-semibold ${settled ? "text-success" : ""}`}>{formatGHS(order.outstandingBalance)}</p>
        </div>
      </div>
      <h3 className="mt-8 text-sm font-semibold">Payments</h3>
      <table className="mt-2 w-full text-[13px]">
        <thead className="text-left text-muted">
          <tr className="border-b border-border">
            <th className="py-2 font-medium">Date</th>
            <th className="py-2 font-medium">Reference</th>
            <th className="py-2 font-medium">Type</th>
            <th className="py-2 text-right font-medium">Applied</th>
          </tr>
        </thead>
        <tbody>
          {payments
            .filter((p) => ["confirmed", "refunded", "reversed"].includes(p.status))
            .map((p) => (
              <tr key={p.reference} className="border-b border-border/60">
                <td className="py-2">{formatDate(p.verifiedAt)}</td>
                <td className="py-2 font-mono text-[12px]">{p.reference}{p.isTest ? " (sandbox)" : ""}</td>
                <td className="py-2 capitalize">{p.kind.replace("_", " ")}</td>
                <td className="tabular py-2 text-right">{formatGHS(p.allocatedAmount)}</td>
              </tr>
            ))}
        </tbody>
      </table>
      <h3 className="mt-8 text-sm font-semibold">Installments</h3>
      <table className="mt-2 w-full text-[13px]">
        <thead className="text-left text-muted">
          <tr className="border-b border-border">
            <th className="py-2 font-medium">#</th>
            <th className="py-2 font-medium">Due</th>
            <th className="py-2 text-right font-medium">Amount</th>
            <th className="py-2 text-right font-medium">Paid</th>
            <th className="py-2 text-right font-medium">Settled</th>
          </tr>
        </thead>
        <tbody>
          {installments.map((i) => (
            <tr key={i.installmentNumber} className="border-b border-border/60">
              <td className="py-2">{i.installmentNumber}</td>
              <td className="py-2">{formatDate(i.dueDate)}</td>
              <td className="tabular py-2 text-right">{formatGHS(i.amountDue)}</td>
              <td className="tabular py-2 text-right">{formatGHS(i.amountPaid)}</td>
              <td className="py-2 text-right">{i.paidAt ? formatDate(i.paidAt) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {settled && (
        <p className="mt-8 rounded-[12px] bg-success-soft p-4 text-sm text-[#0b5132]">
          This confirms that the agreed purchase price of {formatGHS(order.agreedPurchasePrice)} has been paid in full and the outstanding balance is GH₵0.00.
          {order.completedAt ? " The order is completed." : " The order will be marked completed once the device is handed over."}
        </p>
      )}
    </article>
  );
}

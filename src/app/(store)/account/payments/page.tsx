import { CreditCard } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PaymentStatusBadge, SandboxBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, Input, PageHeader, Select, StatCard } from "@/components/ui/primitives";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { formatGHS } from "@/lib/money";
import { escapeRegex } from "@/lib/validation";
import { Order, Payment } from "@/models";
import { requireCustomerPage } from "@/server/auth/session";
import { PAYMENT_STATUSES } from "@/lib/order-status";
import { Types } from "mongoose";

export const metadata: Metadata = { title: "Payment history" };
const PAGE = 15;

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireCustomerPage("/account/payments");
  const sp = await searchParams;
  const customerId = new Types.ObjectId(actor.userId);
  const filter: Record<string, unknown> = { customerId };
  if (sp.q) filter.reference = new RegExp(escapeRegex(sp.q.slice(0, 40)), "i");
  if (sp.status && (PAYMENT_STATUSES as readonly string[]).includes(sp.status)) filter.status = sp.status;
  if (sp.order && Types.ObjectId.isValid(sp.order)) filter.orderId = new Types.ObjectId(sp.order);
  const created: Record<string, Date> = {};
  if (sp.from && !isNaN(Date.parse(sp.from))) created.$gte = new Date(sp.from);
  if (sp.to && !isNaN(Date.parse(sp.to))) created.$lte = new Date(new Date(sp.to).getTime() + 86400000 - 1);
  if (Object.keys(created).length) filter.createdAt = created;
  const page = Math.max(1, Number(sp.page) || 1);

  const [rows, total, orders, totals] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip((page - 1) * PAGE).limit(PAGE).lean(),
    Payment.countDocuments(filter),
    Order.find({ customerId }).select("orderNumber productSnapshot.name").lean(),
    Payment.aggregate([{ $match: { customerId } }, { $group: { _id: "$status", amount: { $sum: "$amount" }, applied: { $sum: "$allocatedAmount" }, refunded: { $sum: "$refundedAmount" }, n: { $sum: 1 } } }]),
  ]);
  const t = (s: string) => totals.find((x) => x._id === s);
  const confirmedNet = ["confirmed", "refunded", "reversed"].reduce((a, s) => a + (t(s)?.applied ?? 0), 0);
  const pendingAmt = (t("pending")?.amount ?? 0) + (t("processing")?.amount ?? 0);
  const failedN = (t("failed")?.n ?? 0) + (t("expired")?.n ?? 0);
  const orderName = new Map(orders.map((o) => [o._id.toString(), o.productSnapshot.name]));
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const qs = (p: number) => {
    const q = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    q.set("page", String(p));
    return `?${q}`;
  };

  return (
    <div>
      <PageHeader title="Payment history" description="Every transaction on your account. Only confirmed payments reduce your balance." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total confirmed paid" value={formatGHS(confirmedNet)} hint="Net of any refunds or reversals" tone="success" />
        <StatCard label="Pending confirmation" value={formatGHS(pendingAmt)} hint="Not yet applied to your balance" />
        <StatCard label="Failed / expired attempts" value={failedN} hint="Never applied to your balance" />
      </div>

      <Card className="mb-4 p-4">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6" role="search">
          <Input name="q" placeholder="Search reference" defaultValue={sp.q} aria-label="Search by reference" className="lg:col-span-2" />
          <Select name="status" defaultValue={sp.status ?? ""} aria-label="Status">
            <option value="">All statuses</option>
            {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </Select>
          <Select name="order" defaultValue={sp.order ?? ""} aria-label="Order">
            <option value="">All orders</option>
            {orders.map((o) => <option key={o._id.toString()} value={o._id.toString()}>{o.orderNumber}</option>)}
          </Select>
          <Input type="date" name="from" defaultValue={sp.from} aria-label="From date" />
          <div className="flex gap-2">
            <Input type="date" name="to" defaultValue={sp.to} aria-label="To date" />
            <Button type="submit">Filter</Button>
          </div>
        </form>
      </Card>

      {rows.length === 0 ? (
        <EmptyState icon={<CreditCard />} title="No transactions found" description="Try changing your filters." />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Reference</TH>
              <TH>Date</TH>
              <TH>Order</TH>
              <TH>Device</TH>
              <TH>Type</TH>
              <TH className="text-right">Amount</TH>
              <TH>Method</TH>
              <TH>Status</TH>
              <TH>Receipt</TH>
            </tr>
          </THead>
          <TBody>
            {rows.map((p) => (
              <TR key={p.reference}>
                <TD className="font-mono text-[12px]">{p.reference} {p.isTest && <SandboxBadge />}</TD>
                <TD className="text-muted">{formatDateTime(p.createdAt)}</TD>
                <TD><Link className="text-accent hover:underline" href={`/account/orders/${p.orderId}`}>{p.orderNumber}</Link></TD>
                <TD>{orderName.get(p.orderId.toString())}</TD>
                <TD className="capitalize">{p.kind.replace("_", " ")}</TD>
                <TD className="tabular text-right font-medium">{formatGHS(p.amount)}</TD>
                <TD className="text-muted">{p.channelDetail || (p.method ? p.method.replace("_", " ") : "—")}</TD>
                <TD><PaymentStatusBadge status={p.status} /></TD>
                <TD>
                  {["confirmed", "refunded", "reversed"].includes(p.status) ? (
                    <Link className="text-accent hover:underline" href={`/account/payments/${p.reference}/receipt`}>View</Link>
                  ) : (
                    <span className="text-subtle">—</span>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-muted">Page {page} of {pages}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" asChild disabled={page <= 1}><Link href={qs(Math.max(1, page - 1))}>Previous</Link></Button>
            <Button size="sm" variant="outline" asChild disabled={page >= pages}><Link href={qs(Math.min(pages, page + 1))}>Next</Link></Button>
          </div>
        </nav>
      )}
    </div>
  );
}

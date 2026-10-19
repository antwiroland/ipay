import { Download } from "lucide-react";
import { MonthlyBars, MonthlyLine, SERIES } from "@/components/admin/charts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Input, PageHeader, Select, StatCard } from "@/components/ui/primitives";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatGHS } from "@/lib/money";
import { hasPermission } from "@/lib/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { financialReport, type Granularity } from "@/server/services/reports";

export const metadata = { title: "Reports & analytics" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireStaffPage("reports.view", "/admin/reports");
  const sp = await searchParams;
  const now = new Date();
  const from = sp.from && !isNaN(Date.parse(sp.from)) ? new Date(sp.from) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const to = sp.to && !isNaN(Date.parse(sp.to)) ? new Date(new Date(sp.to).getTime() + 86400000 - 1) : now;
  const granularity: Granularity = sp.g === "day" || sp.g === "week" ? sp.g : "month";
  const r = await financialReport(actor, { from, to, granularity });
  const canExport = hasPermission(actor.role, "reports.export");
  const q = new URLSearchParams({ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), g: granularity });
  const s = r.summary;

  return (
    <div className="space-y-6">
      <PageHeader title="Reports & analytics" description={`${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)}`} />
      <Card className="p-4">
        <form className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-[12px] text-muted">From<Input type="date" name="from" defaultValue={from.toISOString().slice(0, 10)} /></label>
          <label className="flex flex-col gap-1 text-[12px] text-muted">To<Input type="date" name="to" defaultValue={to.toISOString().slice(0, 10)} /></label>
          <label className="flex flex-col gap-1 text-[12px] text-muted">Group by
            <Select name="g" defaultValue={granularity} className="w-32"><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></Select>
          </label>
          <Button type="submit">Run report</Button>
          {canExport && (
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="outline" asChild><a href={`/api/admin/export/collections?${q}`}><Download /> Collections CSV</a></Button>
              <Button variant="outline" asChild><a href={`/api/admin/export/sales?${q}`}><Download /> Sales CSV</a></Button>
            </div>
          )}
        </form>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Cash collected (net)" value={formatGHS(s.cashCollected)} hint={`Gross ${formatGHS(s.grossCollections)} − refunds ${formatGHS(s.refundsAndReversals)}`} tone="success" />
        <StatCard label="Sales (contract value)" value={formatGHS(s.sales)} hint={`${s.salesCount} plans started`} />
        <StatCard label="Cost of goods sold" value={formatGHS(s.cogs)} />
        <StatCard label="Gross profit" value={formatGHS(s.grossProfit)} hint="Sales − COGS (contract basis)" />
        <StatCard label="Outstanding receivables" value={formatGHS(s.receivables)} hint="Current, all active plans" />
        <StatCard label="Overdue" value={formatGHS(s.overdue)} hint={`${s.overdueCount} installments`} tone={s.overdue ? "danger" : "default"} />
        <StatCard label="Inventory value" value={formatGHS(s.inventoryValue)} hint="Current, at cost" />
        <StatCard label="Completed / failed / new" value={`${s.completedOrders} · ${s.failedPayments} · ${s.newCustomers}`} hint="Completed orders · failed payments · new customers" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Net collections</CardTitle><CardDescription>Per {granularity}, net of refunds and reversals</CardDescription></CardHeader>
          <CardContent><MonthlyBars data={r.collections.map((c) => ({ month: c.period, net: c.net }))} dataKey="net" name="Net collections" /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Customer acquisition</CardTitle><CardDescription>New registrations per {granularity}</CardDescription></CardHeader>
          <CardContent><MonthlyLine data={r.customers.map((c) => ({ month: c.period, count: c.count }))} dataKey="count" name="New customers" money={false} color={SERIES[2]} /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Collections by period</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <THead><tr><TH>Period</TH><TH className="text-right">Gross payments</TH><TH className="text-right">Refunds & reversals</TH><TH className="text-right">Net collected</TH><TH className="text-right">Ledger entries</TH></tr></THead>
            <TBody>
              {r.collections.length === 0 && <tr><TD colSpan={5} className="py-6 text-center text-muted">No collections in this range.</TD></tr>}
              {r.collections.map((c) => (
                <TR key={c.period}><TD>{c.period}</TD><TD className="tabular text-right">{formatGHS(c.gross)}</TD><TD className="tabular text-right">{formatGHS(c.refunds)}</TD><TD className="tabular text-right font-medium">{formatGHS(c.net)}</TD><TD className="tabular text-right">{c.count}</TD></TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Sales by product</CardTitle><CardDescription>Plans started in range (deposit confirmed)</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <THead><tr><TH>Product</TH><TH className="text-right">Units</TH><TH className="text-right">Sales</TH><TH className="text-right">COGS</TH><TH className="text-right">Gross profit</TH></tr></THead>
            <TBody>
              {r.salesByProduct.length === 0 && <tr><TD colSpan={5} className="py-6 text-center text-muted">No sales in this range.</TD></tr>}
              {r.salesByProduct.map((x) => (
                <TR key={x.product}><TD>{x.product}</TD><TD className="tabular text-right">{x.units}</TD><TD className="tabular text-right">{formatGHS(x.sales)}</TD><TD className="tabular text-right">{formatGHS(x.cogs)}</TD><TD className="tabular text-right font-medium">{formatGHS(x.grossProfit)}</TD></TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Failed payments</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {r.failed.length === 0 ? <p className="text-muted">None.</p> : r.failed.map((f) => <div key={f.status} className="flex justify-between"><span className="capitalize text-muted">{f.status}</span><span className="tabular">{f.count} · {formatGHS(f.amount)}</span></div>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Refunds & reversals</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {r.refunds.length === 0 ? <p className="text-muted">None.</p> : r.refunds.map((f) => <div key={f.type} className="flex justify-between"><span className="capitalize text-muted">{f.type}</span><span className="tabular">{f.count} · {formatGHS(f.amount)}</span></div>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Inventory movements</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {r.inventory.length === 0 ? <p className="text-muted">None.</p> : r.inventory.map((f) => <div key={f.type} className="flex justify-between"><span className="capitalize text-muted">{f.type}</span><span className="tabular">{f.movements} moves · net {f.quantity > 0 ? "+" : ""}{f.quantity}</span></div>)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Campaign performance</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <THead><tr><TH>Campaign</TH><TH>Status</TH><TH className="text-right">Impressions</TH><TH className="text-right">Clicks</TH><TH className="text-right">CTR</TH></tr></THead>
            <TBody>
              {r.campaigns.length === 0 && <tr><TD colSpan={5} className="py-6 text-center text-muted">No campaigns in this range.</TD></tr>}
              {r.campaigns.map((c) => <TR key={c.title}><TD>{c.title}</TD><TD className="capitalize">{c.status}</TD><TD className="tabular text-right">{c.impressions}</TD><TD className="tabular text-right">{c.clicks}</TD><TD className="tabular text-right">{c.ctr}%</TD></TR>)}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

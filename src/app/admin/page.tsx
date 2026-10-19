import { AlertTriangle, Boxes, ClipboardCheck, CreditCard, Info, TrendingUp, UserCheck, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { HBarList, InventoryBars, MonthlyBars, MonthlyLine, SERIES } from "@/components/admin/charts";
import { Alert, Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader, StatCard } from "@/components/ui/primitives";
import { formatGHS } from "@/lib/money";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/order-status";
import { hasPermission } from "@/lib/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { dashboardOverview } from "@/server/services/reports";

export const metadata = { title: "Overview" };

export default async function AdminOverview({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const actor = await requireStaffPage("admin.access", "/admin");
  const sp = await searchParams;
  const { stats, series, inventorySeries, ordersByStatus, bestSellers } = await dashboardOverview(actor);
  const finance = hasPermission(actor.role, "reports.view");

  return (
    <div className="space-y-6">
      <PageHeader title={`Good day, ${actor.name.split(" ")[0]}`} description="Live figures from verified orders and confirmed payments." />
      {sp.denied && <Alert tone="warning" icon={<AlertTriangle />}>You don&apos;t have permission to open that page.</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Registered customers" value={stats.totalCustomers.toLocaleString()} hint={`${stats.verifiedCustomers} verified`} icon={<Users />} />
        <StatCard label="Active installment orders" value={stats.activeOrders} hint={`${stats.completedOrders} completed all-time`} icon={<ClipboardCheck />} />
        <StatCard label="Pending applications" value={<Link href="/admin/orders?status=submitted" className="hover:underline">{stats.pendingApplications}</Link>} hint="Awaiting review" icon={<UserCheck />} />
        <StatCard label="Available stock" value={`${stats.inventoryUnits} units`} hint={finance ? `Inventory value ${formatGHS(stats.inventoryValue, { compact: true })} (cost)` : undefined} icon={<Boxes />} />
      </div>

      {finance && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Confirmed payments collected" value={formatGHS(stats.confirmedCollected, { compact: true })} hint="All-time, net of refunds" icon={<CreditCard />} />
          <StatCard label="Outstanding receivables" value={formatGHS(stats.receivables, { compact: true })} hint="Balances on active plans" icon={<Wallet />} />
          <StatCard label="Overdue installments" value={formatGHS(stats.overdueAmount, { compact: true })} hint={`${stats.overdueInstallments} installments · ${stats.overdueOrders} orders`} tone={stats.overdueAmount > 0 ? "danger" : "default"} icon={<AlertTriangle />} />
          <StatCard label="This month" value={formatGHS(stats.monthCollections, { compact: true })} hint={`Collected · sales ${formatGHS(stats.monthSales, { compact: true })} (${stats.monthSalesCount} contracts)`} icon={<TrendingUp />} />
        </div>
      )}

      {finance && (
        <Alert tone="info" icon={<Info />}>
          <strong>Sales</strong> = contract value of plans whose deposit was confirmed. <strong>Collections</strong> = confirmed cash applied to orders (net of refunds).{" "}
          <strong>Receivables</strong> = what customers still owe. Contract value is never counted as cash before it is paid.
        </Alert>
      )}

      {finance && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Cash collections by month</CardTitle>
              <CardDescription>Confirmed payments applied to orders, net of refunds and reversals</CardDescription>
            </CardHeader>
            <CardContent><MonthlyBars data={series} dataKey="collections" name="Collections" /></CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Sales by month</CardTitle>
              <CardDescription>Contract value of plans started (deposit confirmed)</CardDescription>
            </CardHeader>
            <CardContent><MonthlyBars data={series} dataKey="sales" name="Sales" color={SERIES[1]} /></CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>New customer registrations</CardTitle>
          </CardHeader>
          <CardContent><MonthlyLine data={series} dataKey="registrations" name="Registrations" money={false} color={SERIES[2]} height={200} /></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Orders by status</CardTitle>
          </CardHeader>
          <CardContent>
            <HBarList rows={ordersByStatus.sort((a, b) => b.count - a.count).map((r) => ({ label: ORDER_STATUS_LABEL[r.status as OrderStatus] ?? r.status, value: r.count }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Best-selling devices</CardTitle>
            <CardDescription>Plans started, all-time</CardDescription>
          </CardHeader>
          <CardContent>
            {bestSellers.length ? <HBarList rows={bestSellers.map((b) => ({ label: b.name, value: b.units }))} /> : <p className="text-sm text-muted">No sales yet.</p>}
          </CardContent>
        </Card>
      </div>

      {finance && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Outstanding & overdue</CardTitle>
              <CardDescription>Current position</CardDescription>
            </CardHeader>
            <CardContent>
              <HBarList
                money
                rows={[
                  { label: "Outstanding (not overdue)", value: Math.max(0, stats.receivables - stats.overdueAmount) },
                  { label: "Overdue", value: stats.overdueAmount },
                ]}
              />
              <Link href="/admin/installments?status=overdue" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">Open repayment tracking →</Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Inventory movements</CardTitle>
              <CardDescription>Units per month</CardDescription>
            </CardHeader>
            <CardContent><InventoryBars data={inventorySeries} /></CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

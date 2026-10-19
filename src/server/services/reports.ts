/**
 * Financial reporting. Metric definitions (also shown in the UI):
 *  - Sales (contract value): agreedPurchasePrice of orders whose deposit was confirmed (activatedAt) in the period.
 *  - Cash collected: net ledger entries (payments − refunds − reversals) applied to orders in the period.
 *  - Receivables: outstanding balances on active, activated orders right now.
 *  - COGS: cost price snapshot of devices on orders activated in the period.
 *  - Gross profit: Sales − COGS (contract basis, not cash basis).
 *  - Inventory value: units in stock × cost price.
 * The full value of an installment contract is never counted as cash before it is paid.
 */
import { Installment, InventoryMovement, LedgerEntry, Order, Payment, Product, Promotion, Refund, User } from "@/models";
import { type Actor, requirePermission } from "../auth/actor";
import { connectDB } from "../db";

/** Mock/sandbox money never appears in production reports. */
function liveOnly(): Record<string, unknown> {
  return process.env.NODE_ENV === "production" ? { isTest: { $ne: true } } : {};
}

export type Granularity = "day" | "week" | "month";

function dateGroup(field: string, g: Granularity) {
  const fmt = g === "day" ? "%Y-%m-%d" : g === "week" ? "%G-W%V" : "%Y-%m";
  return { $dateToString: { format: fmt, date: `$${field}`, timezone: "UTC" } };
}

export function lastMonths(n: number, now = new Date()) {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

async function overdueSummary(now = new Date()) {
  const candidates = await Installment.find({ dueDate: { $lt: now }, outstandingAmount: { $gt: 0 }, status: { $ne: "cancelled" } })
    .select("orderId dueDate outstandingAmount")
    .lean();
  if (!candidates.length) return { amount: 0, count: 0, orders: 0 };
  const orders = await Order.find({ _id: { $in: [...new Set(candidates.map((c) => c.orderId.toString()))] }, isActive: true })
    .select("planSnapshot.gracePeriodDays orderStatus")
    .lean();
  const grace = new Map(orders.map((o) => [o._id.toString(), o.planSnapshot?.gracePeriodDays ?? 0]));
  let amount = 0;
  let count = 0;
  const orderSet = new Set<string>();
  for (const c of candidates) {
    const g = grace.get(c.orderId.toString());
    if (g == null) continue;
    if (now.getTime() >= new Date(c.dueDate).getTime() + (g + 1) * 86400000) {
      amount += c.outstandingAmount;
      count++;
      orderSet.add(c.orderId.toString());
    }
  }
  return { amount, count, orders: orderSet.size };
}

export async function dashboardOverview(actor: Actor) {
  requirePermission(actor, "admin.access");
  await connectDB();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const yearAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const months = lastMonths(12, now);

  const [
    totalCustomers,
    verifiedCustomers,
    activeOrders,
    completedOrders,
    pendingApplications,
    collectedAll,
    receivables,
    overdue,
    monthSales,
    monthCollections,
    inventory,
    collectionsByMonth,
    salesByMonth,
    registrationsByMonth,
    ordersByStatus,
    bestSellers,
    inventoryByMonth,
  ] = await Promise.all([
    User.countDocuments({ role: "customer" }),
    User.countDocuments({ role: "customer", verificationStatus: "verified" }),
    Order.countDocuments({ isActive: true, depositPaidAt: { $ne: null } }),
    Order.countDocuments({ orderStatus: "completed" }),
    Order.countDocuments({ orderStatus: { $in: ["submitted", "under_review"] } }),
    LedgerEntry.aggregate([{ $match: liveOnly() }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    Order.aggregate([{ $match: { isActive: true, depositPaidAt: { $ne: null } } }, { $group: { _id: null, total: { $sum: "$outstandingBalance" } } }]),
    overdueSummary(now),
    Order.aggregate([
      { $match: { activatedAt: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: "$agreedPurchasePrice" }, count: { $sum: 1 } } },
    ]),
    LedgerEntry.aggregate([{ $match: { createdAt: { $gte: monthStart }, ...liveOnly() } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    Product.aggregate([
      { $match: { isArchived: false } },
      { $group: { _id: null, units: { $sum: "$stockQuantity" }, value: { $sum: { $multiply: ["$stockQuantity", "$costPrice"] } } } },
    ]),
    LedgerEntry.aggregate([
      { $match: { createdAt: { $gte: yearAgo }, ...liveOnly() } },
      { $group: { _id: dateGroup("createdAt", "month"), total: { $sum: "$amount" } } },
    ]),
    Order.aggregate([
      { $match: { activatedAt: { $gte: yearAgo } } },
      { $group: { _id: dateGroup("activatedAt", "month"), total: { $sum: "$agreedPurchasePrice" }, count: { $sum: 1 } } },
    ]),
    User.aggregate([
      { $match: { role: "customer", createdAt: { $gte: yearAgo } } },
      { $group: { _id: dateGroup("createdAt", "month"), count: { $sum: 1 } } },
    ]),
    Order.aggregate([{ $group: { _id: "$orderStatus", count: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { activatedAt: { $ne: null } } },
      { $group: { _id: "$productSnapshot.name", units: { $sum: 1 }, revenue: { $sum: "$agreedPurchasePrice" } } },
      { $sort: { units: -1, revenue: -1 } },
      { $limit: 6 },
    ]),
    InventoryMovement.aggregate([
      { $match: { createdAt: { $gte: yearAgo } } },
      { $group: { _id: { m: dateGroup("createdAt", "month"), t: "$type" }, qty: { $sum: { $abs: "$quantity" } }, n: { $sum: 1 } } },
    ]),
  ]);

  const byKey = <T extends { _id: string }>(rows: T[]) => new Map(rows.map((r) => [r._id, r]));
  const cMap = byKey(collectionsByMonth);
  const sMap = byKey(salesByMonth);
  const rMap = byKey(registrationsByMonth);

  return {
    stats: {
      totalCustomers,
      verifiedCustomers,
      activeOrders,
      completedOrders,
      pendingApplications,
      confirmedCollected: collectedAll[0]?.total ?? 0,
      receivables: receivables[0]?.total ?? 0,
      overdueAmount: overdue.amount,
      overdueInstallments: overdue.count,
      overdueOrders: overdue.orders,
      monthSales: monthSales[0]?.total ?? 0,
      monthSalesCount: monthSales[0]?.count ?? 0,
      monthCollections: monthCollections[0]?.total ?? 0,
      inventoryValue: inventory[0]?.value ?? 0,
      inventoryUnits: inventory[0]?.units ?? 0,
    },
    series: months.map((m) => ({
      month: m,
      collections: cMap.get(m)?.total ?? 0,
      sales: sMap.get(m)?.total ?? 0,
      orders: sMap.get(m)?.count ?? 0,
      registrations: rMap.get(m)?.count ?? 0,
    })),
    inventorySeries: months.map((m) => {
      const rows = inventoryByMonth.filter((r) => r._id.m === m);
      const get = (t: string) => rows.find((r) => r._id.t === t)?.qty ?? 0;
      return { month: m, restock: get("restock"), reserved: get("reserve"), released: get("release"), dispatched: rows.find((r) => r._id.t === "dispatch")?.n ?? 0 };
    }),
    ordersByStatus: ordersByStatus.map((r) => ({ status: r._id as string, count: r.count as number })),
    bestSellers: bestSellers.map((b) => ({ name: b._id as string, units: b.units as number, revenue: b.revenue as number })),
  };
}

export interface ReportRange {
  from: Date;
  to: Date;
  granularity: Granularity;
}

export async function financialReport(actor: Actor, range: ReportRange) {
  requirePermission(actor, "reports.view");
  await connectDB();
  const created = { $gte: range.from, $lte: range.to };
  const [collections, sales, salesByProduct, failed, refunds, completed, customers, inventory, campaigns, receivables, overdue] = await Promise.all([
    LedgerEntry.aggregate([
      { $match: { createdAt: created, ...liveOnly() } },
      {
        $group: {
          _id: dateGroup("createdAt", range.granularity),
          gross: { $sum: { $cond: [{ $gt: ["$amount", 0] }, "$amount", 0] } },
          refunds: { $sum: { $cond: [{ $lt: ["$amount", 0] }, "$amount", 0] } },
          net: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: { activatedAt: created } },
      { $group: { _id: null, sales: { $sum: "$agreedPurchasePrice" }, cogs: { $sum: "$costPriceSnapshot" }, count: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { activatedAt: created } },
      { $group: { _id: "$productSnapshot.name", units: { $sum: 1 }, sales: { $sum: "$agreedPurchasePrice" }, cogs: { $sum: "$costPriceSnapshot" } } },
      { $sort: { sales: -1 } },
    ]),
    Payment.aggregate([
      { $match: { createdAt: created, status: { $in: ["failed", "expired"] }, ...liveOnly() } },
      { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$amount" } } },
    ]),
    Refund.aggregate([{ $match: { createdAt: created } }, { $group: { _id: "$type", count: { $sum: 1 }, amount: { $sum: "$amount" } } }]),
    Order.countDocuments({ completedAt: created }),
    User.aggregate([
      { $match: { role: "customer", createdAt: created } },
      { $group: { _id: dateGroup("createdAt", range.granularity), count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    InventoryMovement.aggregate([{ $match: { createdAt: created } }, { $group: { _id: "$type", qty: { $sum: "$quantity" }, n: { $sum: 1 } } }]),
    Promotion.find({ startDate: { $lte: range.to }, endDate: { $gte: range.from } }).select("title impressions clicks status startDate endDate").lean(),
    Order.aggregate([{ $match: { isActive: true, depositPaidAt: { $ne: null } } }, { $group: { _id: null, total: { $sum: "$outstandingBalance" } } }]),
    overdueSummary(),
  ]);
  const s = sales[0] ?? { sales: 0, cogs: 0, count: 0 };
  const inv = await Product.aggregate([{ $match: { isArchived: false } }, { $group: { _id: null, value: { $sum: { $multiply: ["$stockQuantity", "$costPrice"] } } } }]);
  return {
    summary: {
      cashCollected: collections.reduce((a, r) => a + r.net, 0),
      grossCollections: collections.reduce((a, r) => a + r.gross, 0),
      refundsAndReversals: -collections.reduce((a, r) => a + r.refunds, 0),
      sales: s.sales,
      salesCount: s.count,
      cogs: s.cogs,
      grossProfit: s.sales - s.cogs,
      receivables: receivables[0]?.total ?? 0,
      overdue: overdue.amount,
      overdueCount: overdue.count,
      inventoryValue: inv[0]?.value ?? 0,
      completedOrders: completed,
      failedPayments: failed.reduce((a, r) => a + r.count, 0),
      newCustomers: customers.reduce((a, r) => a + r.count, 0),
    },
    collections: collections.map((r) => ({ period: r._id as string, gross: r.gross, refunds: -r.refunds, net: r.net, count: r.count })),
    salesByProduct: salesByProduct.map((r) => ({ product: r._id as string, units: r.units, sales: r.sales, cogs: r.cogs, grossProfit: r.sales - r.cogs })),
    failed: failed.map((r) => ({ status: r._id as string, count: r.count, amount: r.amount })),
    refunds: refunds.map((r) => ({ type: r._id as string, count: r.count, amount: r.amount })),
    customers: customers.map((r) => ({ period: r._id as string, count: r.count })),
    inventory: inventory.map((r) => ({ type: r._id as string, quantity: r.qty, movements: r.n })),
    campaigns: campaigns.map((c) => ({
      title: c.title,
      status: c.status,
      impressions: c.impressions,
      clicks: c.clicks,
      ctr: c.impressions ? Math.round((c.clicks / c.impressions) * 1000) / 10 : 0,
    })),
  };
}

export function toCsv(rows: Record<string, unknown>[], columns: { key: string; label: string }[]): string {
  const esc = (v: unknown) => {
    let s = v == null ? "" : v instanceof Date ? v.toISOString() : String(v);
    // Neutralise spreadsheet formula injection.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map((c) => esc(c.label)).join(","), ...rows.map((r) => columns.map((c) => esc(r[c.key])).join(","))].join("\n");
}

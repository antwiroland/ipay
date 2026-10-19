import { Types } from "mongoose";
import { deriveInstallmentStatus } from "@/lib/allocation";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/lib/order-status";
import { escapeRegex } from "@/lib/validation";
import { AuditLog, Installment, Order, Payment, User } from "@/models";
import { type Actor, requirePermission } from "../auth/actor";
import { connectDB } from "../db";
import { presentContact } from "./customers";

export type Params = Record<string, string | undefined>;

function dateRange(p: Params, fromKey = "from", toKey = "to") {
  const r: Record<string, Date> = {};
  if (p[fromKey] && !isNaN(Date.parse(p[fromKey]!))) r.$gte = new Date(p[fromKey]!);
  if (p[toKey] && !isNaN(Date.parse(p[toKey]!))) r.$lte = new Date(new Date(p[toKey]!).getTime() + 86400000 - 1);
  return Object.keys(r).length ? r : undefined;
}

async function customerIdsMatching(q: string) {
  const rx = new RegExp(escapeRegex(q.slice(0, 60)), "i");
  return (await User.find({ $or: [{ name: rx }, { email: rx }, { phone: rx }] }).select("_id").limit(500).lean()).map((u) => u._id);
}

async function customerMap(actor: Actor, ids: Types.ObjectId[]) {
  const users = await User.find({ _id: { $in: ids } }).select("name email phone").lean();
  return new Map(users.map((u) => [u._id.toString(), { name: u.name, ...presentContact(actor, u) }]));
}

/* ---------------- Orders ---------------- */
export async function listOrders(actor: Actor, p: Params, limit = 20) {
  requirePermission(actor, "orders.view");
  await connectDB();
  const f: Record<string, unknown> = {};
  if (p.status === "active") f.isActive = true;
  else if (p.status && (ORDER_STATUSES as readonly string[]).includes(p.status)) f.orderStatus = p.status;
  if (p.repayment) f.repaymentStatus = p.repayment;
  if (p.fulfilment) f.fulfilmentStatus = p.fulfilment;
  if (p.model === "take_and_pay" || p.model === "pay_small_small") f["planSnapshot.purchaseModel"] = p.model;
  const created = dateRange(p);
  if (created) f.createdAt = created;
  if (p.q) {
    const rx = new RegExp(escapeRegex(p.q.slice(0, 60)), "i");
    f.$or = [{ orderNumber: rx }, { "productSnapshot.name": rx }, { customerId: { $in: await customerIdsMatching(p.q) } }];
  }
  const page = Math.max(1, Number(p.page) || 1);
  const [items, total] = await Promise.all([Order.find(f).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Order.countDocuments(f)]);
  const customers = await customerMap(actor, items.map((o) => o.customerId));
  return { items: items.map((o) => ({ ...o, customer: customers.get(o.customerId.toString()) })), total, page };
}

/* ---------------- Payments ---------------- */
export async function listPayments(actor: Actor, p: Params, limit = 25) {
  requirePermission(actor, "payments.view");
  await connectDB();
  const f: Record<string, unknown> = {};
  if (p.status && (PAYMENT_STATUSES as readonly string[]).includes(p.status)) f.status = p.status;
  if (p.provider) f.provider = p.provider;
  if (p.recon) f.reconciliationStatus = p.recon;
  if (p.kind) f.kind = p.kind;
  if (p.order && Types.ObjectId.isValid(p.order)) f.orderId = new Types.ObjectId(p.order);
  const created = dateRange(p);
  if (created) f.createdAt = created;
  if (p.q) {
    const rx = new RegExp(escapeRegex(p.q.slice(0, 60)), "i");
    f.$or = [{ reference: rx }, { providerReference: rx }, { orderNumber: rx }, { customerId: { $in: await customerIdsMatching(p.q) } }];
  }
  const page = Math.max(1, Number(p.page) || 1);
  const [items, total, sums] = await Promise.all([
    Payment.find(f).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Payment.countDocuments(f),
    Payment.aggregate([{ $match: f }, { $group: { _id: "$status", amount: { $sum: "$amount" }, n: { $sum: 1 } } }]),
  ]);
  const customers = await customerMap(actor, items.map((x) => x.customerId));
  return { items: items.map((x) => ({ ...x, customer: customers.get(x.customerId.toString()) })), total, page, sums };
}

/* ---------------- Repayment tracking ---------------- */
export async function listInstallments(actor: Actor, p: Params, limit = 30) {
  requirePermission(actor, "installments.view");
  await connectDB();
  const now = new Date();
  const f: Record<string, unknown> = { status: { $ne: "cancelled" } };
  const due = dateRange(p, "dueFrom", "dueTo");
  if (due) f.dueDate = due;
  // Status is derived from dates, so translate it into date/amount conditions (works without the cron having run).
  switch (p.status) {
    case "paid": f.outstandingAmount = 0; break;
    case "overdue": f.outstandingAmount = { $gt: 0 }; f.dueDate = { ...(due ?? {}), $lt: now }; break;
    case "due": f.outstandingAmount = { $gt: 0 }; f.dueDate = { $gte: new Date(now.getTime() - 30 * 86400000), $lte: new Date(now.getTime() + 3 * 86400000) }; break;
    case "upcoming": f.outstandingAmount = { $gt: 0 }; f.dueDate = { $gt: new Date(now.getTime() + 3 * 86400000) }; break;
    case "partially_paid": f.amountPaid = { $gt: 0 }; f.outstandingAmount = { $gt: 0 }; break;
    case "cancelled": f.status = "cancelled"; break;
  }
  const orderFilter: Record<string, unknown> = {};
  if (p.completion === "completed") orderFilter.orderStatus = "completed";
  if (p.completion === "active") orderFilter.isActive = true;
  if (p.product) orderFilter["productSnapshot.name"] = new RegExp(escapeRegex(p.product.slice(0, 60)), "i");
  if (p.q) {
    const rx = new RegExp(escapeRegex(p.q.slice(0, 60)), "i");
    orderFilter.$or = [{ orderNumber: rx }, { customerId: { $in: await customerIdsMatching(p.q) } }];
  }
  if (Object.keys(orderFilter).length) f.orderId = { $in: await Order.distinct("_id", orderFilter) };
  if (p.minOverdue) f.outstandingAmount = { $gte: Math.round(Number(p.minOverdue) * 100) || 1 };

  const page = Math.max(1, Number(p.page) || 1);
  const [rows, total] = await Promise.all([
    Installment.find(f).sort({ dueDate: 1, installmentNumber: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Installment.countDocuments(f),
  ]);
  const orders = await Order.find({ _id: { $in: rows.map((r) => r.orderId) } })
    .select("orderNumber productSnapshot.name outstandingBalance planSnapshot.gracePeriodDays orderStatus customerId")
    .lean();
  const om = new Map(orders.map((o) => [o._id.toString(), o]));
  const customers = await customerMap(actor, orders.map((o) => o.customerId));
  const items = rows.map((r) => {
    const o = om.get(r.orderId.toString());
    const live = deriveInstallmentStatus({ amountDue: r.amountDue, amountPaid: r.amountPaid, dueDate: r.dueDate }, now, o?.planSnapshot?.gracePeriodDays ?? 0);
    const next = live === "overdue" ? "Contact customer" : live === "due" ? "Send reminder" : live === "paid" ? "—" : "Monitor";
    return { ...r, live, order: o, customer: o ? customers.get(o.customerId.toString()) : undefined, nextAction: next };
  });
  return { items, total, page };
}

/* ---------------- Audit ---------------- */
export async function listAudit(actor: Actor, p: Params, limit = 40) {
  requirePermission(actor, "audit.view");
  await connectDB();
  const f: Record<string, unknown> = {};
  if (p.action) f.action = new RegExp(`^${escapeRegex(p.action.slice(0, 60))}`);
  if (p.resource) f.resourceType = p.resource;
  if (p.resourceId) f.resourceId = p.resourceId.slice(0, 40);
  const ts = dateRange(p);
  if (ts) f.timestamp = ts;
  const page = Math.max(1, Number(p.page) || 1);
  const [items, total] = await Promise.all([
    AuditLog.find(f).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).populate("actorId", "name email role").lean(),
    AuditLog.countDocuments(f),
  ]);
  return { items, total, page };
}

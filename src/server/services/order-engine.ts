/**
 * Internal order mechanics shared by the order and payment services.
 * All functions take a ClientSession and must run inside a transaction.
 */
import type { ClientSession, HydratedDocument } from "mongoose";
import { deriveInstallmentStatus, deriveRepaymentStatus } from "@/lib/allocation";
import { isHandedOver } from "@/lib/order-status";
import { scheduleDueDates } from "@/lib/pricing";
import { Installment, type IInstallment, type IOrder } from "@/models";

export type OrderDoc = HydratedDocument<IOrder>;

export function pushStatus(order: OrderDoc, status: string, by?: string | null, note?: string) {
  order.statusHistory.push({ status, at: new Date(), by: (by as never) ?? null, note });
}

/** Generate the installment schedule from the order's immutable contract snapshot. */
export async function createSchedule(order: OrderDoc, start: Date, session: ClientSession) {
  const existing = await Installment.countDocuments({ orderId: order._id }).session(session);
  if (existing > 0) return;
  const amounts = order.pricing.installmentAmounts;
  if (!amounts.length) return;
  const dates = scheduleDueDates(start, {
    frequency: order.planSnapshot.frequency,
    numberOfInstallments: amounts.length,
    dueDayOfMonth: order.planSnapshot.dueDayOfMonth ?? null,
  });
  await Installment.insertMany(
    amounts.map((amountDue, i) => ({
      orderId: order._id,
      customerId: order.customerId,
      orderNumber: order.orderNumber,
      installmentNumber: i + 1,
      dueDate: dates[i],
      amountDue,
      amountPaid: 0,
      outstandingAmount: amountDue,
      status: "upcoming",
    })),
    { session },
  );
}

/** Recompute balance, next due and repayment status. Does not save. */
export async function refreshDerived(order: OrderDoc, session: ClientSession, now = new Date()) {
  const installments = await Installment.find({ orderId: order._id }).sort({ installmentNumber: 1 }).session(session).lean();
  order.outstandingBalance = Math.max(0, order.agreedPurchasePrice - order.amountPaid);
  const grace = order.planSnapshot.gracePeriodDays ?? 0;
  const next = installments.find((i) => i.status !== "cancelled" && i.amountPaid < i.amountDue);
  order.nextDueDate = order.depositPaidAt ? (next?.dueDate ?? null) : null;
  order.nextDueAmount = order.depositPaidAt ? (next ? next.amountDue - next.amountPaid : null) : order.depositAmount;
  order.repaymentStatus = deriveRepaymentStatus(
    { depositPaid: !!order.depositPaidAt, outstanding: order.outstandingBalance, installments: installments.map(asCalc) },
    now,
    grace,
  );
  return installments;
}

export function asCalc(i: Pick<IInstallment, "amountDue" | "amountPaid" | "dueDate" | "status">) {
  return { amountDue: i.amountDue, amountPaid: i.amountPaid, dueDate: i.dueDate, cancelled: i.status === "cancelled" };
}

export function installmentStatusAfter(i: Pick<IInstallment, "amountDue" | "amountPaid" | "dueDate" | "status">, grace: number, now = new Date()) {
  return deriveInstallmentStatus(asCalc(i), now, grace);
}

/**
 * Apply settlement rules after any balance change or fulfilment change.
 *  - balance 0 → repayment fully_paid (+ fullyPaidAt)
 *  - fully paid AND handed over → completed, isActive=false (releases the one-active-order lock)
 *  - fully paid, not handed over → orderStatus fully_paid
 *  - balance re-opened (refund) → back to repayment state
 * Returns which milestones were newly reached so callers can notify after commit.
 */
export function evaluateSettlement(order: OrderDoc, actorId?: string | null) {
  const events = { becameFullyPaid: false, becameCompleted: false };
  if (!order.depositPaidAt || ["completed", "rejected", "cancelled", "suspended"].includes(order.orderStatus)) {
    return events;
  }
  if (order.outstandingBalance === 0) {
    if (!order.fullyPaidAt) {
      order.fullyPaidAt = new Date();
      events.becameFullyPaid = true;
    }
    order.repaymentStatus = "fully_paid";
    if (isHandedOver(order.fulfilmentStatus)) {
      order.orderStatus = "completed";
      order.isActive = false;
      order.completedAt = new Date();
      pushStatus(order, "completed", actorId, "Fully paid and device handed over");
      events.becameCompleted = true;
    } else if (order.orderStatus !== "fully_paid") {
      order.orderStatus = "fully_paid";
      pushStatus(order, "fully_paid", actorId);
      if (order.planSnapshot.purchaseModel === "pay_small_small" && order.fulfilmentStatus === "not_prepared") {
        order.fulfilmentStatus = "preparing";
      }
    }
  } else {
    order.fullyPaidAt = null;
    if (order.orderStatus === "fully_paid") {
      const next =
        order.planSnapshot.purchaseModel === "take_and_pay" && !isHandedOver(order.fulfilmentStatus)
          ? "awaiting_collection"
          : "active_repayment";
      order.orderStatus = next;
      pushStatus(order, next, actorId, "Balance re-opened");
    }
  }
  return events;
}

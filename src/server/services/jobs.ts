import { formatDate } from "@/lib/dates";
import { formatGHS } from "@/lib/money";
import { Installment, Order, Promotion } from "@/models";
import { connectDB, withTransaction } from "../db";
import { notify } from "./notifications";
import { installmentStatusAfter, refreshDerived } from "./order-engine";
import { expireStalePayments } from "./payments";
import { getSettings } from "./settings";

/**
 * Daily housekeeping (Vercel Cron → /api/cron/daily). Idempotent: safe to run more than once a day.
 *  1. Expire stale pending payments.
 *  2. Refresh installment + repayment statuses (due soon / overdue).
 *  3. Send due-soon reminders and overdue notices (deduplicated per installment per day).
 *  4. Archive campaigns that have ended.
 */
export async function runDailyJobs(now = new Date()) {
  await connectDB();
  const settings = await getSettings();
  const expired = await expireStalePayments(now);
  const dayKey = now.toISOString().slice(0, 10);

  const orders = await Order.find({ isActive: true, depositPaidAt: { $ne: null }, outstandingBalance: { $gt: 0 } }).select("_id").lean();
  let refreshed = 0;
  let reminders = 0;
  let overdueNotices = 0;

  for (const { _id } of orders) {
    const touched = await withTransaction(async (session) => {
      const order = await Order.findById(_id).session(session);
      if (!order) return null;
      const grace = order.planSnapshot.gracePeriodDays ?? 0;
      const installments = await Installment.find({ orderId: order._id, status: { $nin: ["paid", "cancelled"] } }).session(session);
      for (const inst of installments) {
        const s = installmentStatusAfter(inst, grace, now);
        if (s !== inst.status) {
          inst.status = s;
          await inst.save({ session });
        }
      }
      await refreshDerived(order, session, now);
      await order.save({ session });
      return { order, installments };
    });
    if (!touched) continue;
    refreshed++;
    const { order, installments } = touched;
    for (const inst of installments) {
      const vars = {
        amount: formatGHS(inst.outstandingAmount),
        dueDate: formatDate(inst.dueDate),
        installmentNumber: inst.installmentNumber,
        orderNumber: order.orderNumber,
      };
      const daysUntil = Math.round((new Date(inst.dueDate).getTime() - now.getTime()) / 86400000);
      if (inst.status !== "overdue" && daysUntil >= 0 && daysUntil <= settings.reminderDaysBefore) {
        await notify(order.customerId, "payment_reminder", vars, { dedupeKey: `reminder:${inst._id}`, link: `/account/orders/${order._id}` });
        reminders++;
      }
      if (inst.status === "overdue") {
        // At most one overdue notice per installment per week.
        const week = Math.floor(now.getTime() / (7 * 86400000));
        await notify(order.customerId, "installment_overdue", vars, { dedupeKey: `overdue:${inst._id}:${week}`, link: `/account/orders/${order._id}` });
        overdueNotices++;
      }
    }
  }

  const archived = await Promotion.updateMany({ status: "published", endDate: { $lt: now } }, { $set: { status: "archived" } });
  return { day: dayKey, expiredPayments: expired, ordersRefreshed: refreshed, reminders, overdueNotices, campaignsArchived: archived.modifiedCount };
}

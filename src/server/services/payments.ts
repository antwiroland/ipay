import { randomBytes } from "node:crypto";
import { Types, type ClientSession } from "mongoose";
import { z } from "zod";
import { allocatePayment, unwindAllocations } from "@/lib/allocation";
import { formatGHS } from "@/lib/money";
import { PAYABLE_STATUSES } from "@/lib/order-status";
import { cediAmountSchema, objectIdSchema } from "@/lib/validation";
import {
  Installment,
  LedgerEntry,
  Order,
  Payment,
  PaymentAllocation,
  Refund,
  User,
  type IPayment,
  type PaymentKind,
} from "@/models";
import { type Actor, assertOwnerOrPermission, requireCustomer, requirePermission } from "../auth/actor";
import { connectDB, withTransaction } from "../db";
import { AppError } from "../errors";
import { activeProvider, providerFor } from "../payments";
import type { VerifyResult } from "../payments/types";
import { rateLimit } from "../rate-limit";
import { audit } from "./audit";
import { parseOrThrow } from "./auth";
import { notify } from "./notifications";
import { createSchedule, evaluateSettlement, installmentStatusAfter, pushStatus, refreshDerived, type OrderDoc } from "./order-engine";
import { getSettings } from "./settings";

export const MIN_PAYMENT = 100; // GH₵1.00

export function newPaymentReference() {
  return `IPGP-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/* ======================= Amount rules ======================= */

export interface PayOptions {
  depositDue: number;
  nextInstallment: { id: string; number: number; amount: number; dueDate: Date } | null;
  outstanding: number;
  allowPartial: boolean;
  allowAdditional: boolean;
  canPay: boolean;
  reason?: string;
}

/** What the customer may pay right now — computed from trusted DB state only. */
export async function paymentOptions(orderId: string): Promise<PayOptions> {
  const order = await Order.findById(orderId).lean();
  if (!order) throw new AppError("NOT_FOUND", "Order not found.");
  const base = {
    depositDue: 0,
    nextInstallment: null,
    outstanding: order.outstandingBalance,
    allowPartial: !!order.planSnapshot.allowPartialPayments,
    allowAdditional: !!order.planSnapshot.allowAdditionalPayments,
  };
  if (!PAYABLE_STATUSES.includes(order.orderStatus)) {
    const reason =
      order.orderStatus === "submitted" || order.orderStatus === "under_review"
        ? "Your application is being reviewed. You can pay the deposit once it is approved."
        : order.outstandingBalance === 0
          ? "This order is fully paid."
          : "Payments are not available for this order right now.";
    return { ...base, canPay: false, reason };
  }
  if (!order.depositPaidAt) {
    return { ...base, depositDue: order.depositAmount - order.amountPaid, canPay: true };
  }
  const next = await Installment.findOne({ orderId: order._id, status: { $ne: "cancelled" }, outstandingAmount: { $gt: 0 } })
    .sort({ installmentNumber: 1 })
    .lean();
  return {
    ...base,
    nextInstallment: next
      ? { id: next._id.toString(), number: next.installmentNumber, amount: next.outstandingAmount, dueDate: next.dueDate }
      : null,
    canPay: order.outstandingBalance > 0,
    reason: order.outstandingBalance > 0 ? undefined : "This order is fully paid.",
  };
}

const initiateSchema = z.object({
  orderId: objectIdSchema,
  kind: z.enum(["deposit", "installment", "additional", "full_balance"]),
  amount: cediAmountSchema.optional(), // only for "additional" (custom amount)
});

/* ======================= Initiate ======================= */

export async function initiatePayment(actor: Actor, input: unknown, appUrl: string) {
  requireCustomer(actor);
  const data = parseOrThrow(initiateSchema, input);
  await rateLimit("payment:init", actor.userId, 20, 600);
  await connectDB();

  const order = await Order.findById(data.orderId).lean();
  // Ownership: never trust the browser — another customer's order is reported as not found.
  if (!order || order.customerId.toString() !== actor.userId) throw new AppError("NOT_FOUND", "Order not found.");

  const opts = await paymentOptions(data.orderId);
  if (!opts.canPay) throw new AppError("INVALID_STATE", opts.reason ?? "Payments are not available for this order.");

  let amount: number;
  let kind: PaymentKind = data.kind;
  let installmentId: string | null = null;

  if (!order.depositPaidAt) {
    if (data.kind !== "deposit") throw new AppError("INVALID_STATE", "Please pay the deposit first.");
    amount = opts.depositDue;
  } else if (data.kind === "deposit") {
    throw new AppError("INVALID_STATE", "The deposit for this order has already been paid.");
  } else if (data.kind === "installment") {
    if (!opts.nextInstallment) throw new AppError("INVALID_STATE", "There is no outstanding installment.");
    amount = opts.nextInstallment.amount;
    installmentId = opts.nextInstallment.id;
  } else if (data.kind === "full_balance") {
    amount = opts.outstanding;
  } else {
    if (data.amount == null) throw new AppError("VALIDATION", "Enter an amount.", { fieldErrors: { amount: ["Enter an amount"] } });
    amount = data.amount;
    const nextAmt = opts.nextInstallment?.amount ?? opts.outstanding;
    if (amount < MIN_PAYMENT) throw new AppError("VALIDATION", `The minimum payment is ${formatGHS(MIN_PAYMENT)}.`, { fieldErrors: { amount: ["Too small"] } });
    if (amount > opts.outstanding) {
      throw new AppError("VALIDATION", `You can pay at most your outstanding balance of ${formatGHS(opts.outstanding)}.`, { fieldErrors: { amount: ["Exceeds balance"] } });
    }
    if (amount < nextAmt && !opts.allowPartial) throw new AppError("NOT_ELIGIBLE", "Partial payments are not permitted on this plan.");
    if (amount > nextAmt && !opts.allowAdditional) throw new AppError("NOT_ELIGIBLE", "Additional payments are not permitted on this plan.");
    kind = amount === opts.outstanding ? "full_balance" : "additional";
  }
  if (amount <= 0) throw new AppError("INVALID_STATE", "Nothing is due on this order.");

  const provider = activeProvider();
  const settings = await getSettings();
  const user = await User.findById(actor.userId).lean();
  const reference = newPaymentReference();
  const payment = await Payment.create({
    reference,
    customerId: order.customerId,
    orderId: order._id,
    orderNumber: order.orderNumber,
    installmentId,
    kind,
    amount,
    currency: "GHS",
    provider: provider.name,
    isTest: provider.isTest,
    status: "pending",
    expiresAt: new Date(Date.now() + settings.pendingPaymentTtlMinutes * 60_000),
  });

  try {
    const init = await provider.initialize({
      reference,
      amount,
      currency: "GHS",
      email: user!.email,
      phone: user!.phone,
      callbackUrl: `${appUrl.replace(/\/$/, "")}/account/payments/return?reference=${encodeURIComponent(reference)}`,
      metadata: { orderNumber: order.orderNumber, kind, customerId: actor.userId },
    });
    await Payment.updateOne({ _id: payment._id }, { $set: { checkoutUrl: init.checkoutUrl, providerReference: init.providerReference ?? null } });
    return { reference, checkoutUrl: init.checkoutUrl, amount, isTest: provider.isTest };
  } catch (err) {
    await Payment.updateOne({ _id: payment._id }, { $set: { status: "failed", failureReason: "Could not start checkout" } });
    console.error("[payment:init]", err);
    throw new AppError("PAYMENT_PROVIDER", "We couldn't start the payment. Please try again in a moment.");
  }
}

/* ======================= Confirm (idempotent) ======================= */

export type ConfirmOutcome =
  | { status: "confirmed"; reference: string; alreadyProcessed: boolean }
  | { status: "failed" | "pending" | "needs_review" | "unknown"; reference: string };

/**
 * Verify a payment with its provider and, if successful, record it exactly once.
 * Safe to call any number of times, concurrently, from webhooks, callback pages and admin tools.
 */
export async function confirmPayment(reference: string, verification?: VerifyResult): Promise<ConfirmOutcome> {
  await connectDB();
  const payment = await Payment.findOne({ reference }).lean();
  if (!payment) return { status: "unknown", reference };
  if (["confirmed", "refunded", "reversed"].includes(payment.status)) {
    return { status: "confirmed", reference, alreadyProcessed: true };
  }

  const v = verification ?? (await providerFor(payment.provider).verify(reference));

  if (v.status === "pending") {
    await Payment.updateOne({ _id: payment._id, status: "pending" }, { $set: { status: "processing" } });
    return { status: "pending", reference };
  }

  if (v.status === "failed" || v.status === "abandoned") {
    const r = await Payment.updateOne(
      { _id: payment._id, status: { $in: ["pending", "processing", "expired"] } },
      { $set: { status: "failed", failureReason: v.gatewayResponse ?? v.status, providerResponse: { status: v.status } } },
    );
    if (r.modifiedCount) {
      await notify(payment.customerId, "payment_failed", { amount: formatGHS(payment.amount), reference }, {
        dedupeKey: `payment-failed:${reference}`,
        link: `/account/orders/${payment.orderId}`,
        channels: ["in_app", "sms"],
      });
    }
    return { status: "failed", reference };
  }

  // Success: the amount, currency and reference must match exactly what we asked for.
  if (v.reference !== reference || v.currency !== "GHS" || v.amount !== payment.amount) {
    await Payment.updateOne(
      { _id: payment._id, status: { $in: ["pending", "processing", "expired", "failed"] } },
      {
        $set: {
          status: "processing",
          reconciliationStatus: "needs_review",
          failureReason: `Verification mismatch: provider reported ${v.currency} ${v.amount} for ${v.reference}`,
        },
      },
    );
    await audit(null, "payment.verification_mismatch", "Payment", payment._id.toString(), {
      metadata: { expected: payment.amount, got: v.amount, currency: v.currency },
    });
    return { status: "needs_review", reference };
  }

  const result = await withTransaction(async (session) => {
    // Atomic claim: only one caller can move this payment to confirmed.
    const claimed = await Payment.findOneAndUpdate(
      { _id: payment._id, status: { $in: ["pending", "processing", "expired", "failed"] } },
      {
        $set: {
          status: "confirmed",
          verifiedAt: new Date(),
          method: v.method ?? null,
          channelDetail: v.channelDetail ?? null,
          providerReference: v.providerReference ?? payment.providerReference ?? null,
          providerResponse: { status: v.status, gatewayResponse: v.gatewayResponse ?? null, paidAt: v.paidAt ?? null },
          failureReason: null,
        },
      },
      { session, returnDocument: "after" },
    );
    if (!claimed) return null;
    const order = await Order.findById(claimed.orderId).session(session);
    if (!order) throw new Error(`Order missing for payment ${reference}`);
    const applied = await applyPaymentToOrder(order, claimed.toObject(), session, null);
    await claimed.updateOne({ $set: applied.paymentUpdate }, { session });
    return { order, applied, payment: claimed.toObject() };
  });

  if (!result) return { status: "confirmed", reference, alreadyProcessed: true };
  await afterPaymentNotifications(result.order, result.payment, result.applied);
  return { status: "confirmed", reference, alreadyProcessed: false };
}

interface ApplyResult {
  allocated: number;
  unallocated: number;
  depositConfirmed: boolean;
  events: { becameFullyPaid: boolean; becameCompleted: boolean };
  paymentUpdate: Partial<IPayment>;
}

/**
 * Allocate a confirmed payment to an order (inside a transaction).
 * Deposit first, then oldest-outstanding installment first; any excess is held as unallocated.
 */
async function applyPaymentToOrder(
  order: OrderDoc,
  payment: IPayment,
  session: ClientSession,
  actorId: string | null,
): Promise<ApplyResult> {
  const now = new Date();
  let remaining = payment.amount;
  let allocated = 0;
  let depositConfirmed = false;
  const acceptsMoney = PAYABLE_STATUSES.includes(order.orderStatus) || order.orderStatus === "suspended";

  if (acceptsMoney && !order.depositPaidAt) {
    const depositDue = order.depositAmount - order.amountPaid;
    const toDeposit = Math.min(depositDue, remaining);
    if (toDeposit > 0) {
      await PaymentAllocation.create([{ paymentId: payment._id, orderId: order._id, installmentId: null, installmentNumber: 0, amount: toDeposit }], { session });
      order.amountPaid += toDeposit;
      allocated += toDeposit;
      remaining -= toDeposit;
    }
    if (order.amountPaid >= order.depositAmount) {
      depositConfirmed = true;
      order.depositPaidAt = now;
      order.activatedAt = now;
      await createSchedule(order, now, session);
      if (order.orderStatus === "awaiting_deposit") {
        const next = order.planSnapshot.purchaseModel === "take_and_pay" ? "awaiting_collection" : "active_repayment";
        order.orderStatus = next;
        pushStatus(order, next, actorId, `Deposit confirmed (${payment.reference})`);
        if (order.planSnapshot.purchaseModel === "take_and_pay") order.fulfilmentStatus = "preparing";
      }
    }
  }

  if (acceptsMoney && order.depositPaidAt && remaining > 0) {
    const installments = await Installment.find({ orderId: order._id }).session(session);
    const { allocations } = allocatePayment(
      remaining,
      installments.map((i) => ({
        id: i._id.toString(),
        installmentNumber: i.installmentNumber,
        amountDue: i.amountDue,
        amountPaid: i.amountPaid,
        cancelled: i.status === "cancelled",
      })),
    );
    const grace = order.planSnapshot.gracePeriodDays ?? 0;
    for (const a of allocations) {
      const inst = installments.find((i) => i._id.toString() === a.installmentId)!;
      inst.amountPaid += a.amount;
      inst.outstandingAmount = inst.amountDue - inst.amountPaid;
      inst.lastPaymentAt = now;
      inst.lastPaymentReference = payment.reference;
      inst.status = installmentStatusAfter(inst, grace, now);
      if (inst.status === "paid") inst.paidAt = now;
      await inst.save({ session });
      allocated += a.amount;
      remaining -= a.amount;
    }
    if (allocations.length) {
      await PaymentAllocation.create(
        allocations.map((a) => ({ paymentId: payment._id, orderId: order._id, installmentId: a.installmentId, installmentNumber: a.installmentNumber, amount: a.amount })),
        { session, ordered: true },
      );
    }
    order.amountPaid = Math.min(order.agreedPurchasePrice, order.amountPaid + allocations.reduce((s, a) => s + a.amount, 0));
  }

  if (allocated > 0) {
    await LedgerEntry.create(
      [
        {
          orderId: order._id,
          customerId: order.customerId,
          paymentId: payment._id,
          type: payment.provider === "manual" ? "manual_payment" : "payment",
          amount: allocated,
          description: `${payment.kind} payment ${payment.reference}`,
          createdBy: actorId,
          isTest: payment.isTest,
        },
      ],
      { session },
    );
  }

  await refreshDerived(order, session, now);
  const events = evaluateSettlement(order, actorId);
  await order.save({ session });

  const unallocated = payment.amount - allocated;
  return {
    allocated,
    unallocated,
    depositConfirmed,
    events,
    paymentUpdate: {
      allocatedAmount: allocated,
      unallocatedAmount: unallocated,
      reconciliationStatus: unallocated > 0 ? "needs_review" : "matched",
    },
  };
}

async function afterPaymentNotifications(order: OrderDoc, payment: IPayment, applied: ApplyResult) {
  const vars = {
    amount: formatGHS(payment.amount),
    reference: payment.reference,
    orderNumber: order.orderNumber,
    product: order.productSnapshot.name,
    outstanding: formatGHS(order.outstandingBalance),
  };
  const link = `/account/orders/${order._id}`;
  if (applied.depositConfirmed) {
    await notify(order.customerId, "deposit_confirmed", vars, { dedupeKey: `deposit:${order._id}`, link });
  } else {
    await notify(order.customerId, "payment_confirmed", vars, { dedupeKey: `payment-confirmed:${payment.reference}`, link });
  }
  if (applied.events.becameCompleted) {
    await notify(order.customerId, "plan_completed", vars, { dedupeKey: `completed:${order._id}`, link });
  }
  if (applied.unallocated > 0) {
    await audit(null, "payment.unallocated_excess", "Payment", payment._id.toString(), { metadata: { unallocated: applied.unallocated } });
  }
}

/* ======================= Manual payment (auditable correction) ======================= */

const manualSchema = z.object({
  orderId: objectIdSchema,
  amount: cediAmountSchema,
  method: z.enum(["cash", "bank_transfer", "mobile_money", "cheque"]),
  externalReference: z.string().trim().max(80).optional(),
  reason: z.string().trim().min(10, "Explain why this payment is being recorded manually").max(500),
});

export async function recordManualPayment(actor: Actor, input: unknown) {
  requirePermission(actor, "payments.manual");
  const data = parseOrThrow(manualSchema, input);
  await connectDB();
  const order = await Order.findById(data.orderId).lean();
  if (!order) throw new AppError("NOT_FOUND", "Order not found.");
  if (!PAYABLE_STATUSES.includes(order.orderStatus)) throw new AppError("INVALID_STATE", "This order is not accepting payments.");
  if (data.amount <= 0 || data.amount > order.outstandingBalance) {
    throw new AppError("VALIDATION", `Amount must be between GH₵0.01 and ${formatGHS(order.outstandingBalance)}.`);
  }
  const reference = newPaymentReference();
  const result = await withTransaction(async (session) => {
    const [payment] = await Payment.create(
      [
        {
          reference,
          providerReference: data.externalReference ?? null,
          customerId: order.customerId,
          orderId: order._id,
          orderNumber: order.orderNumber,
          kind: order.depositPaidAt ? "manual" : "deposit",
          amount: data.amount,
          currency: "GHS",
          method: data.method,
          provider: "manual",
          isTest: false,
          status: "confirmed",
          verifiedAt: new Date(),
          recordedBy: actor.userId,
          manualReason: data.reason,
        },
      ],
      { session },
    );
    const orderDoc = await Order.findById(order._id).session(session);
    const applied = await applyPaymentToOrder(orderDoc!, payment.toObject(), session, actor.userId);
    await payment.updateOne({ $set: applied.paymentUpdate }, { session });
    await audit(actor, "payment.manual_record", "Payment", payment._id.toString(), {
      session,
      reason: data.reason,
      metadata: { orderNumber: order.orderNumber, amount: data.amount, method: data.method },
    });
    return { order: orderDoc!, payment: payment.toObject(), applied };
  });
  await afterPaymentNotifications(result.order, result.payment, result.applied);
  return result.payment;
}

/* ======================= Refunds & reversals ======================= */

const refundSchema = z.object({
  paymentId: objectIdSchema,
  amount: cediAmountSchema,
  type: z.enum(["refund", "reversal"]),
  reason: z.string().trim().min(10, "Give a clear reason (at least 10 characters)").max(500),
});

/**
 * Refund (money returned by us) or reversal (provider chargeback/reversal we must record).
 * Unallocated excess is returned first; balance-affecting amounts unwind newest installment first.
 */
export async function refundPayment(actor: Actor, input: unknown) {
  requirePermission(actor, "payments.refund");
  const data = parseOrThrow(refundSchema, input);
  await connectDB();
  const payment = await Payment.findById(data.paymentId).lean();
  if (!payment) throw new AppError("NOT_FOUND", "Payment not found.");
  if (!["confirmed", "refunded", "reversed"].includes(payment.status)) {
    throw new AppError("INVALID_STATE", "Only confirmed payments can be refunded or reversed.");
  }
  const refundable = payment.amount - payment.refundedAmount;
  if (data.amount <= 0 || data.amount > refundable) {
    throw new AppError("VALIDATION", `Amount must be between GH₵0.01 and ${formatGHS(refundable)}.`);
  }
  const order = await Order.findById(payment.orderId).lean();
  if (!order) throw new AppError("NOT_FOUND", "Order not found.");
  const fromUnallocated = Math.min(data.amount, payment.unallocatedAmount);
  const appliedToBalance = data.amount - fromUnallocated;
  if (appliedToBalance > 0 && order.orderStatus === "completed") {
    throw new AppError(
      "INVALID_STATE",
      "This order is completed. Balance-affecting refunds on completed orders must be handled as a documented offline correction.",
    );
  }

  // Money leaves through the provider first (refunds only). Reversals are recorded after the provider reversed them.
  let providerReference: string | null = null;
  if (data.type === "refund" && payment.provider !== "manual") {
    const r = await providerFor(payment.provider).refund(payment.reference, data.amount);
    if (!r.ok) throw new AppError("PAYMENT_PROVIDER", `The provider refused the refund: ${r.error ?? "unknown error"}`);
    providerReference = r.providerReference ?? null;
  }

  const result = await withTransaction(async (session) => {
    const p = await Payment.findOne({ _id: payment._id, refundedAmount: payment.refundedAmount }).session(session);
    if (!p) throw new AppError("CONFLICT", "This payment changed while you were working. Reload and try again.");
    const orderDoc = await Order.findById(payment.orderId).session(session);
    const [refund] = await Refund.create(
      [
        {
          paymentId: p._id,
          orderId: p.orderId,
          customerId: p.customerId,
          type: data.type,
          amount: data.amount,
          appliedToBalance,
          fromUnallocated,
          reason: data.reason,
          status: "processed",
          providerReference,
          createdBy: actor.userId,
        },
      ],
      { session },
    );

    if (appliedToBalance > 0) {
      if (appliedToBalance > p.allocatedAmount) throw new AppError("VALIDATION", "Refund exceeds the amount applied from this payment.");
      const installments = await Installment.find({ orderId: p.orderId }).session(session);
      const instCalc = installments.map((i) => ({
        id: i._id.toString(),
        installmentNumber: i.installmentNumber,
        amountDue: i.amountDue,
        amountPaid: i.amountPaid,
      }));
      const unwind = unwindAllocations(appliedToBalance, instCalc);
      const grace = orderDoc!.planSnapshot.gracePeriodDays ?? 0;
      for (const a of unwind.allocations) {
        const inst = installments.find((i) => i._id.toString() === a.installmentId)!;
        inst.amountPaid += a.amount; // negative
        inst.outstandingAmount = inst.amountDue - inst.amountPaid;
        inst.status = installmentStatusAfter(inst, grace);
        if (inst.status !== "paid") inst.paidAt = null;
        await inst.save({ session });
      }
      const allocs = unwind.allocations.map((a) => ({
        paymentId: p._id,
        orderId: p.orderId,
        installmentId: a.installmentId,
        installmentNumber: a.installmentNumber,
        amount: a.amount,
        refundId: refund._id,
      }));
      if (unwind.unresolved > 0) {
        // Remaining comes out of the deposit.
        allocs.push({ paymentId: p._id, orderId: p.orderId, installmentId: null as never, installmentNumber: 0, amount: -unwind.unresolved, refundId: refund._id });
      }
      await PaymentAllocation.create(allocs, { session, ordered: true });
      await LedgerEntry.create(
        [
          {
            orderId: p.orderId,
            customerId: p.customerId,
            paymentId: p._id,
            refundId: refund._id,
            type: data.type,
            amount: -appliedToBalance,
            description: `${data.type} of ${p.reference}: ${data.reason}`,
            createdBy: actor.userId,
            isTest: p.isTest,
          },
        ],
        { session },
      );
      orderDoc!.amountPaid -= appliedToBalance;
      p.allocatedAmount -= appliedToBalance;
      await refreshDerived(orderDoc!, session);
      evaluateSettlement(orderDoc!, actor.userId);
      if (orderDoc!.amountPaid < orderDoc!.depositAmount && orderDoc!.orderStatus !== "suspended") {
        orderDoc!.suspendedFromStatus = orderDoc!.orderStatus;
        orderDoc!.orderStatus = "suspended";
        pushStatus(orderDoc!, "suspended", actor.userId, "Net payments fell below the deposit after a refund/reversal");
      }
      await orderDoc!.save({ session });
    }

    p.unallocatedAmount -= fromUnallocated;
    p.refundedAmount += data.amount;
    if (p.refundedAmount >= p.amount) p.status = data.type === "refund" ? "refunded" : "reversed";
    if (p.unallocatedAmount === 0 && p.reconciliationStatus === "needs_review") p.reconciliationStatus = "resolved";
    await p.save({ session });
    await audit(actor, `payment.${data.type}`, "Payment", p._id.toString(), {
      session,
      reason: data.reason,
      metadata: { amount: data.amount, appliedToBalance, fromUnallocated, orderNumber: p.orderNumber },
    });
    return { refund, order: orderDoc!, payment: p };
  });

  await notify(result.payment.customerId, "refund_processed", {
    type: data.type,
    amount: formatGHS(data.amount),
    reference: result.payment.reference,
    outstanding: formatGHS(result.order.outstandingBalance),
  }, { dedupeKey: `refund:${result.refund._id}` });
  return result.refund;
}

/* ======================= Reconciliation ======================= */

/** Recompute the order's balance from the ledger and allocations; report any drift. */
export async function reconcileOrder(orderId: string) {
  await connectDB();
  const oid = new Types.ObjectId(orderId);
  const [order, ledger, allocs, installments] = await Promise.all([
    Order.findById(oid).lean(),
    LedgerEntry.aggregate([{ $match: { orderId: oid } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    PaymentAllocation.aggregate([{ $match: { orderId: oid } }, { $group: { _id: "$installmentId", total: { $sum: "$amount" } } }]),
    Installment.find({ orderId: oid }).lean(),
  ]);
  if (!order) throw new AppError("NOT_FOUND", "Order not found.");
  const ledgerTotal = ledger[0]?.total ?? 0;
  const allocTotal = allocs.reduce((s, a) => s + a.total, 0);
  const instPaid = installments.reduce((s, i) => s + i.amountPaid, 0);
  const depositAlloc = allocs.find((a) => a._id == null)?.total ?? 0;
  const issues: string[] = [];
  if (ledgerTotal !== order.amountPaid) issues.push(`Ledger total ${formatGHS(ledgerTotal)} ≠ order amount paid ${formatGHS(order.amountPaid)}`);
  if (allocTotal !== ledgerTotal) issues.push(`Allocations ${formatGHS(allocTotal)} ≠ ledger ${formatGHS(ledgerTotal)}`);
  if (instPaid + depositAlloc !== allocTotal) issues.push(`Installments paid + deposit ${formatGHS(instPaid + depositAlloc)} ≠ allocations ${formatGHS(allocTotal)}`);
  if (order.outstandingBalance !== Math.max(0, order.agreedPurchasePrice - ledgerTotal)) issues.push("Outstanding balance does not match ledger");
  return { ok: issues.length === 0, ledgerTotal, allocTotal, instPaid, depositAlloc, issues };
}

/** Staff action: re-verify a payment with the provider (e.g. webhook missed). */
export async function reverifyPayment(actor: Actor, paymentId: string) {
  requirePermission(actor, "payments.reconcile");
  await connectDB();
  const p = await Payment.findById(paymentId).lean();
  if (!p) throw new AppError("NOT_FOUND", "Payment not found.");
  if (p.provider === "manual") throw new AppError("INVALID_STATE", "Manual payments have no provider to verify against.");
  const outcome = await confirmPayment(p.reference);
  await audit(actor, "payment.reverify", "Payment", paymentId, { metadata: { outcome: outcome.status } });
  return outcome;
}

export async function markReconciled(actor: Actor, paymentId: string, note: string) {
  requirePermission(actor, "payments.reconcile");
  if (!note || note.trim().length < 5) throw new AppError("VALIDATION", "Add a note explaining the resolution.");
  await connectDB();
  const p = await Payment.findById(paymentId);
  if (!p) throw new AppError("NOT_FOUND", "Payment not found.");
  if (p.unallocatedAmount > 0) throw new AppError("INVALID_STATE", "Refund the unallocated excess before resolving.");
  p.reconciliationStatus = p.status === "confirmed" || p.status === "refunded" ? "resolved" : p.reconciliationStatus;
  await p.save();
  await audit(actor, "payment.reconcile", "Payment", paymentId, { reason: note });
}

/** Mark stale pending payments as expired (a later verified success is still honoured). */
export async function expireStalePayments(now = new Date()) {
  await connectDB();
  const r = await Payment.updateMany({ status: { $in: ["pending", "processing"] }, expiresAt: { $lt: now } }, { $set: { status: "expired" } });
  return r.modifiedCount;
}

/* ======================= Customer queries ======================= */

export async function getPaymentForActor(actor: Actor, reference: string) {
  await connectDB();
  if (!/^[A-Z0-9-]{6,60}$/i.test(reference)) throw new AppError("NOT_FOUND", "Payment not found.");
  const p = await Payment.findOne({ reference }).lean();
  if (!p) throw new AppError("NOT_FOUND", "Payment not found.");
  assertOwnerOrPermission(actor, p.customerId.toString(), "payments.view");
  return p;
}

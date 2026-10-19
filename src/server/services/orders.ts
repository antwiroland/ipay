import { Types } from "mongoose";
import { z } from "zod";
import { formatGHS } from "@/lib/money";
import { imageForColour } from "@/lib/utils";
import { canTransition, isHandedOver, type FulfilmentStatus, type OrderStatus } from "@/lib/order-status";
import { PricingError, quote } from "@/lib/pricing";
import { objectIdSchema } from "@/lib/validation";
import { InventoryMovement, Order, Payment, PaymentPlan, Product, User, Installment } from "@/models";
import { type Actor, assertOwnerOrPermission, requireCustomer, requirePermission } from "../auth/actor";
import { connectDB, isDuplicateKeyError, withTransaction } from "../db";
import { ACTIVE_ORDER_MESSAGE, AppError } from "../errors";
import { rateLimit } from "../rate-limit";
import { audit } from "./audit";
import { parseOrThrow } from "./auth";
import { campaignDiscountFor, planToPricing } from "./catalog";
import { notify } from "./notifications";
import { evaluateSettlement, pushStatus, refreshDerived, type OrderDoc } from "./order-engine";
import { getSettings, nextOrderNumber } from "./settings";

const ACTIVE_INDEX = "one_active_order_per_customer";

export async function getActiveOrder(customerId: string) {
  await connectDB();
  return Order.findOne({ customerId, isActive: true }).lean();
}

/* ======================= Eligibility ======================= */

export async function checkEligibility(actor: Actor, planId?: string) {
  requireCustomer(actor);
  await connectDB();
  const [user, active] = await Promise.all([User.findById(actor.userId).lean(), getActiveOrder(actor.userId)]);
  if (!user) throw new AppError("NOT_FOUND", "Account not found.");
  const reasons: string[] = [];
  if (user.accountStatus !== "active") reasons.push("Your account is not active.");
  if (active) reasons.push(ACTIVE_ORDER_MESSAGE);
  let needsVerification = false;
  if (planId) {
    const plan = await PaymentPlan.findById(planId).lean();
    if (plan?.eligibility.requiresVerification && !["pending", "verified"].includes(user.verificationStatus)) {
      needsVerification = true;
      reasons.push("This plan requires identity verification. Submit your ID details from your profile first.");
    }
    if (plan?.eligibility.minAccountAgeDays) {
      const ageDays = (Date.now() - user.createdAt.getTime()) / 86400000;
      if (ageDays < plan.eligibility.minAccountAgeDays) {
        reasons.push(`This plan is available to accounts older than ${plan.eligibility.minAccountAgeDays} days.`);
      }
    }
  }
  return { eligible: reasons.length === 0, reasons, activeOrderId: active?._id.toString() ?? null, needsVerification };
}

/* ======================= Create (apply) ======================= */

const createOrderSchema = z.object({
  productId: objectIdSchema,
  planId: objectIdSchema,
  colour: z.string().trim().max(40).optional().default(""),
  addOnKeys: z.array(z.string().max(40)).max(10).optional().default([]),
  acceptTerms: z.literal(true, { error: "You must accept the installment agreement" }),
  termsVersion: z.string().max(40),
});

export async function createOrder(actor: Actor, input: unknown) {
  requireCustomer(actor);
  const data = parseOrThrow(createOrderSchema, input);
  await rateLimit("order:create", actor.userId, 10, 3600);
  await connectDB();

  // ---- Friendly pre-checks (the unique index below is the real guarantee) ----
  const eligibility = await checkEligibility(actor, data.planId);
  if (eligibility.activeOrderId) throw new AppError("ACTIVE_ORDER_EXISTS", ACTIVE_ORDER_MESSAGE);
  if (!eligibility.eligible) throw new AppError("NOT_ELIGIBLE", eligibility.reasons[0]);

  const [product, plan, settings] = await Promise.all([
    Product.findOne({ _id: data.productId, isPublished: true, isArchived: false }).lean(),
    PaymentPlan.findOne({ _id: data.planId, isActive: true }).lean(),
    getSettings(),
  ]);
  if (!product) throw new AppError("NOT_FOUND", "This product is no longer available.");
  if (!plan) throw new AppError("NOT_FOUND", "This payment plan is no longer available.");
  if (settings.purchaseModels[plan.purchaseModel]?.enabled === false) {
    throw new AppError("NOT_ELIGIBLE", "This purchase option is currently unavailable.");
  }
  if (product.planIds?.length && !product.planIds.some((id) => id.equals(plan._id))) {
    throw new AppError("NOT_ELIGIBLE", "This plan is not offered for this device.");
  }
  if (!product.isAvailable || product.stockQuantity < 1) throw new AppError("OUT_OF_STOCK", "This device is currently out of stock.");
  if (data.termsVersion !== plan.termsVersion) {
    throw new AppError("CONFLICT", "The plan terms have been updated. Please review the latest terms and try again.");
  }
  const colour = data.colour || product.colourOptions?.[0]?.name || "";
  if (product.colourOptions?.length && !product.colourOptions.some((c) => c.name === colour)) {
    throw new AppError("VALIDATION", "Please choose an available colour.", { fieldErrors: { colour: ["Unavailable colour"] } });
  }

  // ---- Authoritative server-side pricing ----
  const campaign = await campaignDiscountFor(product._id);
  let q;
  try {
    q = quote(product, planToPricing(plan), { addOnKeys: data.addOnKeys, campaign });
  } catch (e) {
    if (e instanceof PricingError) throw new AppError("VALIDATION", e.message);
    throw e;
  }

  const needsApproval = plan.eligibility.requiresApproval;
  const now = new Date();
  const initialStatus: OrderStatus = needsApproval ? "submitted" : "awaiting_deposit";

  try {
    const order = await withTransaction(async (session) => {
      // Atomic, conditional stock reservation.
      const reserved = await Product.findOneAndUpdate(
        { _id: product._id, stockQuantity: { $gte: 1 }, isAvailable: true, isPublished: true },
        { $inc: { stockQuantity: -1 } },
        { session, returnDocument: "after" },
      );
      if (!reserved) throw new AppError("OUT_OF_STOCK", "This device just went out of stock.");

      const orderNumber = await nextOrderNumber(session);
      const [created] = await Order.create(
        [
          {
            orderNumber,
            customerId: actor.userId,
            productId: product._id,
            planId: plan._id,
            productSnapshot: {
              name: product.name,
              slug: product.slug,
              model: product.model,
              storage: product.storage,
              colour,
              condition: product.condition,
              image: imageForColour(product.images ?? [], colour)?.url ?? "",
              cashPrice: q.cashPrice,
              listInstallmentPrice: product.installmentPrice,
            },
            planSnapshot: {
              name: plan.name,
              code: plan.code,
              purchaseModel: plan.purchaseModel,
              depositType: plan.depositType,
              depositValue: plan.depositValue,
              frequency: plan.frequency,
              numberOfInstallments: plan.numberOfInstallments,
              markupBps: plan.markupBps,
              dueDayOfMonth: plan.dueDayOfMonth ?? null,
              gracePeriodDays: plan.gracePeriodDays,
              latePaymentPolicy: plan.latePaymentPolicy,
              allowPartialPayments: plan.allowPartialPayments,
              allowAdditionalPayments: plan.allowAdditionalPayments,
              requiresVerification: plan.eligibility.requiresVerification,
              requiresApproval: plan.eligibility.requiresApproval,
              termsText: plan.termsText,
            },
            pricing: {
              basePrice: q.basePrice,
              promoApplied: q.promoApplied,
              addOns: q.addOns,
              addOnsTotal: q.addOnsTotal,
              markup: q.markup,
              fees: q.fees,
              feesTotal: q.feesTotal,
              financed: q.financed,
              installmentAmounts: q.installmentAmounts,
            },
            costPriceSnapshot: product.costPrice ?? 0,
            agreedPurchasePrice: q.contractPrice,
            depositAmount: q.deposit,
            amountPaid: 0,
            outstandingBalance: q.contractPrice,
            orderStatus: initialStatus,
            repaymentStatus: "not_started",
            fulfilmentStatus: "not_prepared",
            isActive: true,
            agreedTermsVersion: plan.termsVersion,
            termsAcceptedAt: now,
            approvedAt: needsApproval ? null : now,
            nextDueAmount: q.deposit,
            statusHistory: [
              { status: "submitted", at: now, by: actor.userId },
              ...(needsApproval ? [] : [{ status: "awaiting_deposit", at: now, note: "Auto-approved by plan rules" }]),
            ],
          },
        ],
        { session },
      );
      await InventoryMovement.create(
        [{ productId: product._id, type: "reserve", quantity: -1, orderId: created._id, actorId: actor.userId, stockAfter: reserved.stockQuantity }],
        { session },
      );
      await audit(actor, "order.create", "Order", created._id.toString(), {
        session,
        metadata: { orderNumber, contractPrice: q.contractPrice, plan: plan.code },
      });
      return created;
    });

    if (!needsApproval) {
      await notify(actor.userId, "application_approved", {
        orderNumber: order.orderNumber,
        product: order.productSnapshot.name,
        deposit: formatGHS(order.depositAmount),
      }, { dedupeKey: `approved:${order._id}`, link: `/account/orders/${order._id}` });
    }
    return order;
  } catch (err) {
    // A concurrent request created the active order first: the partial unique index rejected this one.
    if (isDuplicateKeyError(err) && String((err as Error).message).includes(ACTIVE_INDEX)) {
      throw new AppError("ACTIVE_ORDER_EXISTS", ACTIVE_ORDER_MESSAGE);
    }
    if (isDuplicateKeyError(err) && String((err as Error).message).includes("customerId")) {
      throw new AppError("ACTIVE_ORDER_EXISTS", ACTIVE_ORDER_MESSAGE);
    }
    throw err;
  }
}

/* ======================= Queries ======================= */

export async function getOrderForActor(actor: Actor, orderId: string) {
  if (!Types.ObjectId.isValid(orderId)) throw new AppError("NOT_FOUND", "Order not found.");
  await connectDB();
  const order = await Order.findById(orderId).lean();
  if (!order) throw new AppError("NOT_FOUND", "Order not found.");
  assertOwnerOrPermission(actor, order.customerId.toString(), "orders.view");
  const [installments, payments] = await Promise.all([
    Installment.find({ orderId: order._id }).sort({ installmentNumber: 1 }).lean(),
    Payment.find({ orderId: order._id }).sort({ createdAt: -1 }).lean(),
  ]);
  return { order, installments, payments };
}

export async function listCustomerOrders(actor: Actor) {
  await connectDB();
  return Order.find({ customerId: actor.userId }).sort({ createdAt: -1 }).lean();
}

/* ======================= Staff workflow ======================= */

async function loadOrderDoc(orderId: string, session: import("mongoose").ClientSession): Promise<OrderDoc> {
  if (!Types.ObjectId.isValid(orderId)) throw new AppError("NOT_FOUND", "Order not found.");
  const order = await Order.findById(orderId).session(session);
  if (!order) throw new AppError("NOT_FOUND", "Order not found.");
  return order;
}

function assertTransition(order: OrderDoc, to: OrderStatus) {
  if (!canTransition(order.orderStatus, to)) {
    throw new AppError("INVALID_STATE", `An order that is "${order.orderStatus.replace(/_/g, " ")}" cannot move to "${to.replace(/_/g, " ")}".`);
  }
}

export async function startReview(actor: Actor, orderId: string) {
  requirePermission(actor, "orders.review");
  return withTransaction(async (session) => {
    const order = await loadOrderDoc(orderId, session);
    assertTransition(order, "under_review");
    order.orderStatus = "under_review";
    pushStatus(order, "under_review", actor.userId);
    await order.save({ session });
    await audit(actor, "order.start_review", "Order", orderId, { session });
    return order;
  });
}

export async function approveOrder(actor: Actor, orderId: string, note?: string) {
  requirePermission(actor, "orders.review");
  const order = await withTransaction(async (session) => {
    const order = await loadOrderDoc(orderId, session);
    assertTransition(order, "awaiting_deposit");
    if (order.planSnapshot.requiresVerification) {
      const customer = await User.findById(order.customerId).session(session).lean();
      if (customer?.verificationStatus !== "verified") {
        throw new AppError("NOT_ELIGIBLE", "The customer's identity must be verified before this application can be approved.");
      }
    }
    order.orderStatus = "awaiting_deposit";
    order.approvedAt = new Date();
    order.approvedBy = new Types.ObjectId(actor.userId);
    pushStatus(order, "awaiting_deposit", actor.userId, note || "Application approved");
    await order.save({ session });
    await audit(actor, "order.approve", "Order", orderId, { session, reason: note ?? null });
    return order;
  });
  await notify(order.customerId, "application_approved", {
    orderNumber: order.orderNumber,
    product: order.productSnapshot.name,
    deposit: formatGHS(order.depositAmount),
  }, { dedupeKey: `approved:${order._id}`, link: `/account/orders/${order._id}` });
  return order;
}

async function releaseStock(order: OrderDoc, actor: Actor, session: import("mongoose").ClientSession, note: string) {
  if (isHandedOver(order.fulfilmentStatus)) return; // device already left; nothing to release
  const p = await Product.findOneAndUpdate({ _id: order.productId }, { $inc: { stockQuantity: 1 } }, { session, returnDocument: "after" });
  await InventoryMovement.create(
    [{ productId: order.productId, type: "release", quantity: 1, orderId: order._id, actorId: actor.userId, note, stockAfter: p?.stockQuantity ?? null }],
    { session },
  );
}

export async function rejectOrder(actor: Actor, orderId: string, reason: string) {
  requirePermission(actor, "orders.review");
  const r = z.string().trim().min(5, "Give the customer a clear reason (at least 5 characters)").max(500).safeParse(reason);
  if (!r.success) throw new AppError("VALIDATION", r.error.issues[0].message);
  const order = await withTransaction(async (session) => {
    const order = await loadOrderDoc(orderId, session);
    assertTransition(order, "rejected");
    order.orderStatus = "rejected";
    order.isActive = false; // releases the customer's eligibility
    order.rejectionReason = r.data;
    order.fulfilmentStatus = "cancelled";
    pushStatus(order, "rejected", actor.userId, r.data);
    await order.save({ session });
    await releaseStock(order, actor, session, "Application rejected");
    await audit(actor, "order.reject", "Order", orderId, { session, reason: r.data });
    return order;
  });
  await notify(order.customerId, "application_rejected", {
    orderNumber: order.orderNumber,
    product: order.productSnapshot.name,
    reason: r.data,
  }, { dedupeKey: `rejected:${order._id}`, link: `/account/orders/${order._id}` });
  return order;
}

export async function cancelOrder(actor: Actor, orderId: string, reason: string) {
  const r = z.string().trim().min(3, "Please give a reason").max(500).safeParse(reason);
  if (!r.success) throw new AppError("VALIDATION", r.error.issues[0].message);
  return withTransaction(async (session) => {
    const order = await loadOrderDoc(orderId, session);
    const isOwner = order.customerId.toString() === actor.userId;
    if (isOwner) {
      if (!["submitted", "under_review", "awaiting_deposit"].includes(order.orderStatus)) {
        throw new AppError("INVALID_STATE", "This order can no longer be cancelled online. Please contact support.");
      }
    } else {
      requirePermission(actor, "orders.manage");
    }
    assertTransition(order, "cancelled");
    if (order.amountPaid > 0) {
      throw new AppError("INVALID_STATE", "Refund all confirmed payments before cancelling this order.");
    }
    const pending = await Payment.countDocuments({ orderId: order._id, status: { $in: ["pending", "processing"] } }).session(session);
    if (pending > 0 && !isOwner) {
      throw new AppError("INVALID_STATE", "This order has payments in progress. Wait for them to settle or expire first.");
    }
    if (pending > 0) await Payment.updateMany({ orderId: order._id, status: { $in: ["pending", "processing"] } }, { $set: { status: "expired" } }, { session });
    order.orderStatus = "cancelled";
    order.isActive = false;
    order.cancellationReason = r.data;
    order.fulfilmentStatus = "cancelled";
    pushStatus(order, "cancelled", actor.userId, r.data);
    await order.save({ session });
    await Installment.updateMany({ orderId: order._id, status: { $ne: "paid" } }, { $set: { status: "cancelled" } }, { session });
    await releaseStock(order, actor, session, "Order cancelled");
    await audit(actor, "order.cancel", "Order", orderId, { session, reason: r.data });
    return order;
  });
}

export async function suspendOrder(actor: Actor, orderId: string, reason: string) {
  requirePermission(actor, "orders.manage");
  if (!reason || reason.trim().length < 5) throw new AppError("VALIDATION", "A reason is required.");
  return withTransaction(async (session) => {
    const order = await loadOrderDoc(orderId, session);
    assertTransition(order, "suspended");
    order.suspendedFromStatus = order.orderStatus;
    order.orderStatus = "suspended";
    pushStatus(order, "suspended", actor.userId, reason);
    await order.save({ session });
    await audit(actor, "order.suspend", "Order", orderId, { session, reason });
    return order;
  });
}

export async function resumeOrder(actor: Actor, orderId: string, reason: string) {
  requirePermission(actor, "orders.manage");
  return withTransaction(async (session) => {
    const order = await loadOrderDoc(orderId, session);
    if (order.orderStatus !== "suspended") throw new AppError("INVALID_STATE", "Order is not suspended.");
    let to: OrderStatus = order.suspendedFromStatus ?? "active_repayment";
    if (!order.depositPaidAt) throw new AppError("INVALID_STATE", "Order has no confirmed deposit; cancel it instead.");
    if (to === "fully_paid" && order.outstandingBalance > 0) to = "active_repayment";
    order.orderStatus = to;
    order.suspendedFromStatus = null;
    pushStatus(order, to, actor.userId, reason || "Resumed");
    await refreshDerived(order, session);
    evaluateSettlement(order, actor.userId);
    await order.save({ session });
    await audit(actor, "order.resume", "Order", orderId, { session, reason });
    return order;
  });
}

/* ======================= Fulfilment ======================= */

export async function updateFulfilment(actor: Actor, orderId: string, to: FulfilmentStatus, note?: string) {
  requirePermission(actor, "orders.fulfil");
  const result = await withTransaction(async (session) => {
    const order = await loadOrderDoc(orderId, session);
    const model = order.planSnapshot.purchaseModel;
    if (["completed", "rejected", "cancelled", "suspended"].includes(order.orderStatus)) {
      throw new AppError("INVALID_STATE", "Fulfilment cannot change for this order.");
    }
    if (!order.depositPaidAt) throw new AppError("INVALID_STATE", "The deposit has not been confirmed yet.");
    if (isHandedOver(order.fulfilmentStatus)) throw new AppError("INVALID_STATE", "The device has already been handed over.");
    if (to === "cancelled") throw new AppError("INVALID_STATE", "Cancel the order instead.");

    if (to === "collected" || to === "delivered") {
      if (model === "pay_small_small" && order.outstandingBalance > 0) {
        throw new AppError("INVALID_STATE", "Pay Small-Small devices are released only after the contract is fully paid.");
      }
      if (order.planSnapshot.requiresVerification) {
        const customer = await User.findById(order.customerId).session(session).lean();
        if (customer?.verificationStatus !== "verified") {
          throw new AppError("NOT_ELIGIBLE", "Verify the customer's identity before releasing the device.");
        }
      }
      order.collectedAt = new Date();
      await InventoryMovement.create(
        [{ productId: order.productId, type: "dispatch", quantity: 0, orderId: order._id, actorId: actor.userId, note: note ?? to }],
        { session },
      );
      if (order.orderStatus === "awaiting_collection") {
        order.orderStatus = "active_repayment";
        pushStatus(order, "active_repayment", actor.userId, "Device handed over");
      }
    }
    order.fulfilmentStatus = to;
    pushStatus(order, `fulfilment:${to}`, actor.userId, note);
    await refreshDerived(order, session);
    const events = evaluateSettlement(order, actor.userId);
    await order.save({ session });
    await audit(actor, `order.fulfilment.${to}`, "Order", orderId, { session, reason: note ?? null });
    return { order, events };
  });
  const { order } = result;
  const vars = { orderNumber: order.orderNumber, product: order.productSnapshot.name };
  if (to === "ready_for_collection") await notify(order.customerId, "device_ready", vars, { dedupeKey: `ready:${order._id}` });
  if (to === "collected" || to === "delivered") await notify(order.customerId, "device_collected", vars, { dedupeKey: `collected:${order._id}` });
  if (result.events.becameCompleted) {
    await notify(order.customerId, "plan_completed", vars, { dedupeKey: `completed:${order._id}`, link: `/account/orders/${order._id}` });
  }
  return order;
}

/** Controlled completion: only succeeds when financial AND fulfilment conditions both hold. */
export async function completeOrder(actor: Actor, orderId: string) {
  requirePermission(actor, "orders.manage");
  const res = await withTransaction(async (session) => {
    const order = await loadOrderDoc(orderId, session);
    await refreshDerived(order, session);
    if (order.outstandingBalance > 0) throw new AppError("INVALID_STATE", `Outstanding balance is ${formatGHS(order.outstandingBalance)}.`);
    if (!isHandedOver(order.fulfilmentStatus)) throw new AppError("INVALID_STATE", "Record device collection or delivery first.");
    const events = evaluateSettlement(order, actor.userId);
    await order.save({ session });
    await audit(actor, "order.complete", "Order", orderId, { session });
    return { order, events };
  });
  if (res.events.becameCompleted) {
    await notify(res.order.customerId, "plan_completed", { product: res.order.productSnapshot.name }, { dedupeKey: `completed:${res.order._id}` });
  }
  return res.order;
}

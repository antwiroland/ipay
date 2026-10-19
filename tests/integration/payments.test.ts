import { beforeAll, describe, expect, it } from "vitest";
import { Installment, LedgerEntry, Notification, Order, Payment } from "@/models";
import { setMockOutcome } from "@/server/payments/mock";
import { createOrder, getOrderForActor, updateFulfilment } from "@/server/services/orders";
import { confirmPayment, initiatePayment, reconcileOrder, recordManualPayment, refundPayment } from "@/server/services/payments";
import { APP_URL, makePlan, makeProduct, makeUser, orderInput, pay, setupDb } from "../helpers";

beforeAll(setupDb);

async function freshOrder(planOverrides = {}) {
  const customer = await makeUser();
  const [plan, product] = await Promise.all([makePlan(planOverrides), makeProduct()]);
  const order = await createOrder(customer, orderInput(product.id, plan.id));
  return { customer, order, product, plan };
}

describe("payment lifecycle", () => {
  it("deposit → schedule → installments, matching the specification example", async () => {
    const { customer, order } = await freshOrder();
    expect(order.orderStatus).toBe("awaiting_deposit");

    // Installments cannot be paid before the deposit.
    await expect(initiatePayment(customer, { orderId: order.id, kind: "installment" }, APP_URL)).rejects.toMatchObject({ code: "INVALID_STATE" });

    const dep = await pay(customer, order.id, "deposit");
    expect(dep.amount).toBe(264000);
    expect(dep.outcome.status).toBe("confirmed");

    let o = (await Order.findById(order.id).lean())!;
    expect(o.amountPaid).toBe(264000);
    expect(o.outstandingBalance).toBe(396000);
    expect(o.orderStatus).toBe("awaiting_collection");
    expect(await Installment.countDocuments({ orderId: order.id })).toBe(12);

    // Additional confirmed payments of GH₵1,320.00 → total paid GH₵3,960.00, outstanding GH₵2,640.00, 60%.
    await pay(customer, order.id, "additional", "1320");
    o = (await Order.findById(order.id).lean())!;
    expect(o.amountPaid).toBe(396000);
    expect(o.outstandingBalance).toBe(264000);
    const inst = await Installment.find({ orderId: order.id }).sort({ installmentNumber: 1 }).lean();
    expect(inst.slice(0, 4).every((i) => i.status === "paid")).toBe(true);
    expect(inst[4].amountPaid).toBe(0);
    expect((await reconcileOrder(order.id)).ok).toBe(true);
  });

  it("pending and failed payments never reduce the balance", async () => {
    const { customer, order } = await freshOrder();
    const pending = await initiatePayment(customer, { orderId: order.id, kind: "deposit" }, APP_URL);
    expect((await confirmPayment(pending.reference)).status).toBe("pending");
    let o = (await Order.findById(order.id).lean())!;
    expect(o.amountPaid).toBe(0);
    expect(o.outstandingBalance).toBe(660000);

    await setMockOutcome(pending.reference, "failed");
    expect((await confirmPayment(pending.reference)).status).toBe("failed");
    o = (await Order.findById(order.id).lean())!;
    expect(o.amountPaid).toBe(0);
    expect((await Payment.findOne({ reference: pending.reference }).lean())!.status).toBe("failed");
    expect(await LedgerEntry.countDocuments({ orderId: order.id })).toBe(0);

    // Retry succeeds.
    await pay(customer, order.id, "deposit");
    o = (await Order.findById(order.id).lean())!;
    expect(o.amountPaid).toBe(264000);
  });

  it("duplicate and concurrent webhooks never double-count", async () => {
    const { customer, order } = await freshOrder();
    const r = await initiatePayment(customer, { orderId: order.id, kind: "deposit" }, APP_URL);
    await setMockOutcome(r.reference, "success");
    const outcomes = await Promise.all(Array.from({ length: 8 }, () => confirmPayment(r.reference)));
    expect(outcomes.filter((x) => x.status === "confirmed" && !x.alreadyProcessed)).toHaveLength(1);
    expect(outcomes.every((x) => x.status === "confirmed")).toBe(true);
    await confirmPayment(r.reference);
    const o = (await Order.findById(order.id).lean())!;
    expect(o.amountPaid).toBe(264000);
    expect(await LedgerEntry.countDocuments({ orderId: order.id })).toBe(1);
    expect(await Notification.countDocuments({ userId: customer.userId, template: "deposit_confirmed", channel: "in_app" })).toBe(1);
  });

  it("rejects amounts above the outstanding balance and verification mismatches", async () => {
    const { customer, order } = await freshOrder();
    await pay(customer, order.id, "deposit");
    await expect(initiatePayment(customer, { orderId: order.id, kind: "additional", amount: "5000" }, APP_URL)).rejects.toMatchObject({ code: "VALIDATION" });

    const r = await initiatePayment(customer, { orderId: order.id, kind: "installment" }, APP_URL);
    const outcome = await confirmPayment(r.reference, { status: "success", amount: 100, currency: "GHS", reference: r.reference });
    expect(outcome.status).toBe("needs_review");
    expect((await Order.findById(order.id).lean())!.amountPaid).toBe(264000);
  });

  it("customers cannot pay or view another customer's order", async () => {
    const { order } = await freshOrder();
    const intruder = await makeUser();
    await expect(initiatePayment(intruder, { orderId: order.id, kind: "deposit" }, APP_URL)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getOrderForActor(intruder, order.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const support = await makeUser("support");
    await expect(getOrderForActor(support, order.id)).resolves.toBeTruthy();
  });

  it("respects plan rules for partial payments", async () => {
    const { customer, order } = await freshOrder({ allowPartialPayments: false });
    await pay(customer, order.id, "deposit");
    await expect(initiatePayment(customer, { orderId: order.id, kind: "additional", amount: "100" }, APP_URL)).rejects.toMatchObject({ code: "NOT_ELIGIBLE" });
  });

  it("excess from overlapping checkouts is held unallocated, not counted", async () => {
    const { customer, order } = await freshOrder();
    await pay(customer, order.id, "deposit");
    const a = await initiatePayment(customer, { orderId: order.id, kind: "full_balance" }, APP_URL);
    const b = await initiatePayment(customer, { orderId: order.id, kind: "full_balance" }, APP_URL);
    await setMockOutcome(a.reference, "success");
    await setMockOutcome(b.reference, "success");
    await confirmPayment(a.reference);
    await confirmPayment(b.reference);
    const o = (await Order.findById(order.id).lean())!;
    expect(o.amountPaid).toBe(660000);
    expect(o.outstandingBalance).toBe(0);
    const pb = (await Payment.findOne({ reference: b.reference }).lean())!;
    expect(pb.unallocatedAmount).toBe(396000);
    expect(pb.reconciliationStatus).toBe("needs_review");
    expect((await reconcileOrder(order.id)).ok).toBe(true);
  });
});

describe("completion and renewed eligibility", () => {
  it("fully paid ≠ completed until the device is handed over; then the customer can order again", async () => {
    const { customer, order, product, plan } = await freshOrder();
    const sales = await makeUser("sales_officer");
    await pay(customer, order.id, "deposit");
    await pay(customer, order.id, "full_balance");
    let o = (await Order.findById(order.id).lean())!;
    expect(o.outstandingBalance).toBe(0);
    expect(o.repaymentStatus).toBe("fully_paid");
    expect(o.orderStatus).toBe("fully_paid"); // not collected yet
    expect(o.isActive).toBe(true);
    await expect(createOrder(customer, orderInput(product.id, plan.id))).rejects.toMatchObject({ code: "ACTIVE_ORDER_EXISTS" });

    await updateFulfilment(sales, order.id, "collected", "Collected at Accra store");
    o = (await Order.findById(order.id).lean())!;
    expect(o.orderStatus).toBe("completed");
    expect(o.isActive).toBe(false);
    expect(o.completedAt).toBeTruthy();
    expect((await Installment.find({ orderId: order.id }).lean()).every((i) => i.status === "paid")).toBe(true);

    const next = await createOrder(customer, orderInput(product.id, plan.id));
    expect(next.isActive).toBe(true);
    // History preserved.
    expect(await Payment.countDocuments({ orderId: order.id, status: "confirmed" })).toBe(2);
  });

  it("Pay Small-Small devices cannot be released before full payment", async () => {
    const { customer, order } = await freshOrder({ purchaseModel: "pay_small_small" });
    const sales = await makeUser("sales_officer");
    await pay(customer, order.id, "deposit");
    expect((await Order.findById(order.id).lean())!.orderStatus).toBe("active_repayment");
    await expect(updateFulfilment(sales, order.id, "collected")).rejects.toMatchObject({ code: "INVALID_STATE" });
    await pay(customer, order.id, "full_balance");
    const o = (await Order.findById(order.id).lean())!;
    expect(o.orderStatus).toBe("fully_paid");
    expect(o.fulfilmentStatus).toBe("preparing");
    await updateFulfilment(sales, order.id, "collected");
    expect((await Order.findById(order.id).lean())!.orderStatus).toBe("completed");
  });
});

describe("refunds, reversals and manual payments", () => {
  it("refund unwinds newest installments, re-opens a fully paid order, and is audited", async () => {
    const { customer, order } = await freshOrder();
    const finance = await makeUser("finance_officer");
    await pay(customer, order.id, "deposit");
    const full = await pay(customer, order.id, "full_balance");
    const p = (await Payment.findOne({ reference: full.reference }).lean())!;
    await refundPayment(finance, { paymentId: p._id.toString(), amount: "500", type: "refund", reason: "Customer overpaid by mistake" });
    const o = (await Order.findById(order.id).lean())!;
    expect(o.amountPaid).toBe(660000 - 50000);
    expect(o.outstandingBalance).toBe(50000);
    expect(o.orderStatus).toBe("awaiting_collection");
    const last = (await Installment.findOne({ orderId: order.id, installmentNumber: 12 }).lean())!;
    expect(last.amountPaid).toBe(0); // newest installment fully unwound first
    expect(last.status).not.toBe("paid");
    const eleventh = (await Installment.findOne({ orderId: order.id, installmentNumber: 11 }).lean())!;
    expect(eleventh.amountPaid).toBe(33000 - 17000);
    expect((await reconcileOrder(order.id)).ok).toBe(true);
    expect(await LedgerEntry.countDocuments({ orderId: order.id, type: "refund", amount: -50000 })).toBe(1);
  });

  it("only authorised roles can refund or record manual payments", async () => {
    const { customer, order } = await freshOrder();
    await pay(customer, order.id, "deposit");
    const p = (await Payment.findOne({ orderId: order.id }).lean())!;
    const sales = await makeUser("sales_officer");
    await expect(refundPayment(sales, { paymentId: p._id.toString(), amount: "10", type: "refund", reason: "Testing permissions here" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(recordManualPayment(sales, { orderId: order.id, amount: "10", method: "cash", reason: "Paid cash at the store today" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(refundPayment(customer, { paymentId: p._id.toString(), amount: "10", type: "refund", reason: "I want my money back" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("manual payment is an audited correction applied like any other payment", async () => {
    const { customer, order } = await freshOrder();
    const finance = await makeUser("finance_officer");
    await pay(customer, order.id, "deposit");
    await recordManualPayment(finance, { orderId: order.id, amount: "330", method: "cash", reason: "Paid cash at Accra store, receipt #1042" });
    const o = (await Order.findById(order.id).lean())!;
    expect(o.amountPaid).toBe(264000 + 33000);
    expect(await LedgerEntry.countDocuments({ orderId: order.id, type: "manual_payment" })).toBe(1);
  });

  it("the ledger is append-only", async () => {
    await expect(LedgerEntry.updateMany({}, { $set: { amount: 0 } })).rejects.toThrow(/append-only/);
    await expect(LedgerEntry.deleteMany({})).rejects.toThrow(/append-only/);
  });
});

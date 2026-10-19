import { beforeAll, describe, expect, it } from "vitest";
import { InventoryMovement, Order, Product } from "@/models";
import { AppError } from "@/server/errors";
import { createOrder, rejectOrder } from "@/server/services/orders";
import { makePlan, makeProduct, makeUser, orderInput, setupDb } from "../helpers";

beforeAll(setupDb);

describe("one active installment order per customer", () => {
  it("blocks a second order sequentially, with the required message", async () => {
    const customer = await makeUser();
    const [plan, p1, p2] = await Promise.all([makePlan(), makeProduct(), makeProduct()]);
    await createOrder(customer, orderInput(p1.id, plan.id));
    const err = await createOrder(customer, orderInput(p2.id, plan.id)).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe("ACTIVE_ORDER_EXISTS");
    expect(err.message).toBe(
      "You currently have an active installment plan. Complete your outstanding balance before applying for another device.",
    );
  });

  it("allows exactly one order when 10 requests race concurrently, and reserves stock once", async () => {
    const customer = await makeUser();
    const plan = await makePlan();
    const product = await makeProduct({ stockQuantity: 20 });
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => createOrder(customer, orderInput(product.id, plan.id))));
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(9);
    for (const f of failed) expect((f.reason as AppError).code).toBe("ACTIVE_ORDER_EXISTS");
    expect(await Order.countDocuments({ customerId: customer.userId, isActive: true })).toBe(1);
    // Aborted transactions rolled back their stock reservations.
    expect((await Product.findById(product.id).lean())!.stockQuantity).toBe(19);
    expect(await InventoryMovement.countDocuments({ productId: product.id, type: "reserve" })).toBe(1);
  });

  it("enforces the rule at the database level even if application checks are bypassed", async () => {
    const customer = await makeUser();
    const existing = await Order.findOne({ isActive: true }).lean();
    const clone = { ...existing!, _id: undefined, orderNumber: `X-${Date.now()}`, customerId: customer.userId };
    await Order.create(clone);
    await expect(Order.create({ ...clone, orderNumber: `Y-${Date.now()}` })).rejects.toMatchObject({ code: 11000 });
  });

  it("does not let different customers block each other, and never oversells stock", async () => {
    const plan = await makePlan();
    const product = await makeProduct({ stockQuantity: 3 });
    const customers = await Promise.all(Array.from({ length: 6 }, () => makeUser()));
    const results = await Promise.allSettled(customers.map((c) => createOrder(c, orderInput(product.id, plan.id))));
    const ok = results.filter((r) => r.status === "fulfilled");
    expect(ok).toHaveLength(3);
    const reasons = results.filter((r): r is PromiseRejectedResult => r.status === "rejected").map((r) => (r.reason as AppError).code);
    expect(reasons.every((c) => c === "OUT_OF_STOCK")).toBe(true);
    expect((await Product.findById(product.id).lean())!.stockQuantity).toBe(0);
  });

  it("releases eligibility and stock when an application is rejected", async () => {
    const customer = await makeUser();
    const staff = await makeUser("sales_officer");
    const plan = await makePlan({ eligibility: { requiresApproval: true, requiresVerification: true, minAccountAgeDays: 0 } });
    const product = await makeProduct({ stockQuantity: 1 });
    const order = await createOrder(customer, orderInput(product.id, plan.id));
    expect(order.orderStatus).toBe("submitted");
    expect((await Product.findById(product.id).lean())!.stockQuantity).toBe(0);
    await rejectOrder(staff, order.id, "Incomplete documentation provided");
    expect((await Product.findById(product.id).lean())!.stockQuantity).toBe(1);
    const second = await createOrder(customer, orderInput(product.id, plan.id));
    expect(second.isActive).toBe(true);
  });

  it("requires identity verification for plans that need it", async () => {
    const customer = await makeUser("customer", { verificationStatus: "unverified" });
    const [plan, product] = await Promise.all([makePlan(), makeProduct()]);
    const err = await createOrder(customer, orderInput(product.id, plan.id)).catch((e) => e);
    expect(err.code).toBe("NOT_ELIGIBLE");
  });

  it("rejects stale terms versions and staff accounts", async () => {
    const customer = await makeUser();
    const [plan, product] = await Promise.all([makePlan(), makeProduct()]);
    const stale = await createOrder(customer, orderInput(product.id, plan.id, { termsVersion: "v0" })).catch((e) => e);
    expect(stale.code).toBe("CONFLICT");
    const admin = await makeUser("admin");
    const staffErr = await createOrder(admin, orderInput(product.id, plan.id)).catch((e) => e);
    expect(staffErr.code).toBe("FORBIDDEN");
  });

  it("snapshots the contract so later price changes do not affect it", async () => {
    const customer = await makeUser();
    const [plan, product] = await Promise.all([makePlan(), makeProduct()]);
    const order = await createOrder(customer, orderInput(product.id, plan.id));
    await Product.updateOne({ _id: product.id }, { $set: { installmentPrice: 900000 } });
    const fresh = await Order.findById(order.id).lean();
    expect(fresh!.agreedPurchasePrice).toBe(660000);
    expect(fresh!.depositAmount).toBe(264000);
    expect(fresh!.pricing.installmentAmounts).toEqual(Array(12).fill(33000));
  });
});

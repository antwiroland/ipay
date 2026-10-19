import { beforeAll, describe, expect, it } from "vitest";
import { AuditLog, InventoryMovement, Product, Promotion, User } from "@/models";
import { createSession, destroySession, resolveSession } from "@/server/services/auth";
import { createOrder } from "@/server/services/orders";
import { deleteProduct, updateStock } from "@/server/services/products";
import { makePlan, makeProduct, makeUser, orderInput, setupDb } from "../helpers";

beforeAll(setupDb);

const stockOf = async (id: string) => (await Product.findById(id).lean())!.stockQuantity;

describe("stock updates", () => {
  it("adds, removes and sets exact stock, logging every movement", async () => {
    const admin = await makeUser("admin");
    const p = await makeProduct({ stockQuantity: 5 });
    await updateStock(admin, p.id, { op: "add", quantity: 10, note: "Supplier delivery" });
    expect(await stockOf(p.id)).toBe(15);
    await updateStock(admin, p.id, { op: "remove", quantity: 3, note: "Damaged in storage" });
    expect(await stockOf(p.id)).toBe(12);
    await updateStock(admin, p.id, { op: "set", quantity: 7, note: "Physical count" });
    expect(await stockOf(p.id)).toBe(7);
    const moves = await InventoryMovement.find({ productId: p.id }).sort({ createdAt: 1 }).lean();
    expect(moves.map((m) => m.quantity)).toEqual([10, -3, -5]);
    expect(moves.map((m) => m.stockAfter)).toEqual([15, 12, 7]);
    expect(await AuditLog.countDocuments({ resourceId: p.id, action: /^inventory\./ })).toBe(3);
  });

  it("never lets stock go below zero and requires a reason for removals", async () => {
    const admin = await makeUser("admin");
    const p = await makeProduct({ stockQuantity: 2 });
    await expect(updateStock(admin, p.id, { op: "remove", quantity: 3, note: "Too many" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(updateStock(admin, p.id, { op: "remove", quantity: 1, note: "" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(updateStock(admin, p.id, { op: "set", quantity: -1, note: "Negative" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(updateStock(admin, p.id, { op: "add", quantity: 1.5 })).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await stockOf(p.id)).toBe(2);
  });

  it("is restricted to staff who manage products", async () => {
    const p = await makeProduct({ stockQuantity: 2 });
    const finance = await makeUser("finance_officer");
    const customer = await makeUser();
    await expect(updateStock(finance, p.id, { op: "add", quantity: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(updateStock(customer, p.id, { op: "add", quantity: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const sales = await makeUser("sales_officer");
    await updateStock(sales, p.id, { op: "add", quantity: 1 });
    expect(await stockOf(p.id)).toBe(3);
  });

  it("keeps order reservations intact when stock is set at the same time", async () => {
    const admin = await makeUser("admin");
    const plan = await makePlan();
    const p = await makeProduct({ stockQuantity: 10 });
    const customers = await Promise.all(Array.from({ length: 4 }, () => makeUser()));
    const results = await Promise.allSettled([
      ...customers.map((c) => createOrder(c, orderInput(p.id, plan.id))),
      updateStock(admin, p.id, { op: "add", quantity: 5, note: "Delivery" }),
    ]);
    const orders = results.slice(0, 4).filter((r) => r.status === "fulfilled").length;
    const stockAdded = results[4].status === "fulfilled" ? 5 : 0;
    expect(orders).toBe(4);
    expect(await stockOf(p.id)).toBe(10 - orders + stockAdded);
  });
});

describe("product deletion", () => {
  it("deletes a product with no orders and unlinks it from campaigns", async () => {
    const admin = await makeUser("admin");
    const p = await makeProduct();
    await Promotion.create({ title: "Promo", desktopImage: "/a.svg", mobileImage: "/a.svg", destination: "/shop", startDate: new Date(), endDate: new Date(Date.now() + 86400000), linkedProductIds: [p._id] });
    await deleteProduct(admin, p.id);
    expect(await Product.exists({ _id: p.id })).toBeNull();
    expect((await Promotion.findOne({ title: "Promo" }).lean())!.linkedProductIds).toHaveLength(0);
    expect(await AuditLog.countDocuments({ action: "product.delete", resourceId: p.id })).toBe(1);
  });

  it("refuses to delete a product that has orders (archive instead)", async () => {
    const admin = await makeUser("admin");
    const customer = await makeUser();
    const [plan, p] = await Promise.all([makePlan(), makeProduct()]);
    await createOrder(customer, orderInput(p.id, plan.id));
    await expect(deleteProduct(admin, p.id)).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(await Product.exists({ _id: p.id })).not.toBeNull();
  });

  it("requires products.manage", async () => {
    const support = await makeUser("support");
    const p = await makeProduct();
    await expect(deleteProduct(support, p.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("logout", () => {
  it("destroys the server-side session so the cookie stops working", async () => {
    const actor = await makeUser();
    const user = await User.findById(actor.userId).lean();
    const { token } = await createSession(user!, {}, true);
    expect(await resolveSession(token)).not.toBeNull();
    await destroySession(token);
    expect(await resolveSession(token)).toBeNull();
  });
});

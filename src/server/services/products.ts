import { Types } from "mongoose";
import { z } from "zod";
import { cediAmountSchema } from "@/lib/validation";
import { InventoryMovement, Order, Product, Promotion } from "@/models";
import { type Actor, requirePermission } from "../auth/actor";
import { connectDB, isDuplicateKeyError, withTransaction } from "../db";
import { AppError } from "../errors";
import { audit } from "./audit";
import { parseOrThrow } from "./auth";

const optionalMoney = z
  .union([z.literal(""), z.null(), z.undefined(), cediAmountSchema])
  .transform((v) => (v === "" || v == null ? null : (v as number)));
const optionalDate = z
  .union([z.literal(""), z.null(), z.undefined(), z.coerce.date()])
  .transform((v) => (v === "" || v == null ? null : (v as Date)));

export const productInputSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes"),
    description: z.string().trim().max(5000).default(""),
    model: z.string().trim().min(2).max(60),
    series: z.coerce.number().int().min(1).max(99),
    storage: z.string().trim().regex(/^\d+(GB|TB)$/, "e.g. 128GB or 1TB"),
    condition: z.enum(["brand_new", "uk_used"]),
    colourOptions: z.array(z.object({ name: z.string().trim().min(1).max(40), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/) })).max(12).default([]),
    images: z.array(z.object({ url: z.string().min(1).max(500), alt: z.string().max(160).default(""), publicId: z.string().max(200).nullish() })).max(10).default([]),
    specs: z.array(z.object({ label: z.string().trim().min(1).max(60), value: z.string().trim().min(1).max(200) })).max(30).default([]),
    cashPrice: cediAmountSchema,
    installmentPrice: cediAmountSchema,
    costPrice: cediAmountSchema.default(0),
    promoCashPrice: optionalMoney,
    promoInstallmentPrice: optionalMoney,
    promoStartsAt: optionalDate,
    promoEndsAt: optionalDate,
    addOns: z.array(z.object({ key: z.string().regex(/^[a-z0-9-]{2,40}$/), name: z.string().trim().min(2).max(80), price: cediAmountSchema })).max(10).default([]),
    planIds: z.array(z.string().regex(/^[a-f0-9]{24}$/)).max(20).default([]),
    isFeatured: z.boolean().default(false),
    isPublished: z.boolean().default(false),
    isAvailable: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.cashPrice <= 0) ctx.addIssue({ code: "custom", path: ["cashPrice"], message: "Cash price must be above zero" });
    if (v.installmentPrice < v.cashPrice) ctx.addIssue({ code: "custom", path: ["installmentPrice"], message: "Installment price cannot be below the cash price" });
    if (v.promoInstallmentPrice != null && v.promoInstallmentPrice >= v.installmentPrice) {
      ctx.addIssue({ code: "custom", path: ["promoInstallmentPrice"], message: "Promotional price must be lower than the regular price" });
    }
    if ((v.promoInstallmentPrice != null || v.promoCashPrice != null) && !v.promoEndsAt) {
      ctx.addIssue({ code: "custom", path: ["promoEndsAt"], message: "Set an end date for the promotion" });
    }
    if (v.promoStartsAt && v.promoEndsAt && v.promoEndsAt <= v.promoStartsAt) {
      ctx.addIssue({ code: "custom", path: ["promoEndsAt"], message: "Promotion must end after it starts" });
    }
    if (v.isPublished && v.images.length === 0) ctx.addIssue({ code: "custom", path: ["images"], message: "Add at least one image before publishing" });
  });

function storageGb(s: string) {
  const n = parseInt(s, 10);
  return s.endsWith("TB") ? n * 1024 : n;
}

export async function createProduct(actor: Actor, input: unknown, initialStock = 0) {
  requirePermission(actor, "products.manage");
  const data = parseOrThrow(productInputSchema, input);
  if (!Number.isInteger(initialStock) || initialStock < 0) throw new AppError("VALIDATION", "Stock cannot be negative.");
  await connectDB();
  try {
    return await withTransaction(async (session) => {
      const [p] = await Product.create(
        [{ ...data, storageGb: storageGb(data.storage), stockQuantity: initialStock, publishedAt: data.isPublished ? new Date() : null }],
        { session },
      );
      if (initialStock > 0) {
        await InventoryMovement.create([{ productId: p._id, type: "restock", quantity: initialStock, actorId: actor.userId, note: "Initial stock", stockAfter: initialStock }], { session });
      }
      await audit(actor, "product.create", "Product", p._id.toString(), { session, metadata: { name: p.name, installmentPrice: p.installmentPrice } });
      return p;
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) throw new AppError("CONFLICT", "That URL slug is already used.", { fieldErrors: { slug: ["Already in use"] } });
    throw err;
  }
}

export async function updateProduct(actor: Actor, productId: string, input: unknown) {
  requirePermission(actor, "products.manage");
  const data = parseOrThrow(productInputSchema, input);
  await connectDB();
  const before = await Product.findById(productId).lean();
  if (!before) throw new AppError("NOT_FOUND", "Product not found.");
  try {
    const updated = await Product.findByIdAndUpdate(
      productId,
      {
        $set: {
          ...data,
          storageGb: storageGb(data.storage),
          publishedAt: data.isPublished ? (before.publishedAt ?? new Date()) : before.publishedAt,
        },
      },
      { returnDocument: "after", runValidators: true },
    );
    const priceFields = ["cashPrice", "installmentPrice", "costPrice", "promoCashPrice", "promoInstallmentPrice"] as const;
    const priceChanges = Object.fromEntries(
      priceFields.filter((f) => (before[f] ?? null) !== (data[f] ?? null)).map((f) => [f, { from: before[f] ?? null, to: data[f] ?? null }]),
    );
    await audit(actor, Object.keys(priceChanges).length ? "product.price_change" : "product.update", "Product", productId, {
      metadata: { name: data.name, priceChanges, isPublished: data.isPublished },
    });
    return updated;
  } catch (err) {
    if (isDuplicateKeyError(err)) throw new AppError("CONFLICT", "That URL slug is already used.", { fieldErrors: { slug: ["Already in use"] } });
    throw err;
  }
}

export async function setProductFlags(
  actor: Actor,
  productId: string,
  flags: Partial<{ isPublished: boolean; isFeatured: boolean; isAvailable: boolean; isArchived: boolean }>,
) {
  requirePermission(actor, "products.manage");
  await connectDB();
  const set: Record<string, unknown> = { ...flags };
  if (flags.isArchived) set.isPublished = false;
  if (flags.isPublished) {
    const p = await Product.findById(productId).lean();
    if (!p?.images?.length) throw new AppError("VALIDATION", "Add at least one image before publishing.");
    set.publishedAt = p.publishedAt ?? new Date();
  }
  const p = await Product.findByIdAndUpdate(productId, { $set: set }, { returnDocument: "after" });
  if (!p) throw new AppError("NOT_FOUND", "Product not found.");
  await audit(actor, "product.flags", "Product", productId, { metadata: flags });
  return p;
}

const stockSchema = z.object({
  /** add: +quantity · remove: −quantity · set: make stock exactly `quantity` */
  op: z.enum(["add", "remove", "set"]),
  quantity: z.coerce.number({ error: "Enter a whole number" }).int("Enter a whole number").min(0, "Quantity cannot be negative").max(100_000),
  note: z.string().trim().max(300).optional().default(""),
});

/**
 * Change stock atomically and record an inventory movement. Stock can never go below zero.
 * Units already reserved by orders were deducted when the order was placed, so "stock" is always units free to sell.
 */
export async function updateStock(actor: Actor, productId: string, input: unknown) {
  requirePermission(actor, "products.manage");
  const data = parseOrThrow(stockSchema, input);
  if (!Types.ObjectId.isValid(productId)) throw new AppError("NOT_FOUND", "Product not found.");
  if (data.op !== "set" && data.quantity === 0) throw new AppError("VALIDATION", "Enter a quantity greater than zero.", { fieldErrors: { quantity: ["Must be at least 1"] } });
  if (data.op !== "add" && data.note.length < 3) {
    throw new AppError("VALIDATION", "Add a short reason (e.g. damaged, stock count correction).", { fieldErrors: { note: ["A reason is required"] } });
  }
  return withTransaction(async (session) => {
    const current = await Product.findById(productId).session(session).select("stockQuantity").lean();
    if (!current) throw new AppError("NOT_FOUND", "Product not found.");
    const delta = data.op === "add" ? data.quantity : data.op === "remove" ? -data.quantity : data.quantity - current.stockQuantity;
    if (delta === 0) return { product: current, delta };
    if (current.stockQuantity + delta < 0) {
      throw new AppError("VALIDATION", `Only ${current.stockQuantity} in stock — you can't remove ${-delta}.`, { fieldErrors: { quantity: ["More than is in stock"] } });
    }
    // Conditional on the value we read, so a concurrent order reservation can't be overwritten.
    const p = await Product.findOneAndUpdate(
      { _id: productId, stockQuantity: current.stockQuantity },
      { $inc: { stockQuantity: delta } },
      { session, returnDocument: "after" },
    );
    if (!p) throw new AppError("CONFLICT", "Stock changed while you were editing. Please try again.");
    const type = data.op === "add" ? "restock" : "adjustment";
    const note = data.note || (data.op === "add" ? "Stock added" : "Stock updated");
    await InventoryMovement.create([{ productId: p._id, type, quantity: delta, actorId: actor.userId, note: `${data.op === "set" ? "Set to " + data.quantity + " · " : ""}${note}`, stockAfter: p.stockQuantity }], { session });
    await audit(actor, `inventory.${data.op}`, "Product", productId, { session, reason: note, metadata: { delta, stockBefore: current.stockQuantity, stockAfter: p.stockQuantity } });
    return { product: p, delta };
  });
}

/**
 * Permanently delete a product. Only allowed when no order has ever referenced it — otherwise archive it,
 * so order history, reports and inventory records stay intact.
 */
export async function deleteProduct(actor: Actor, productId: string) {
  requirePermission(actor, "products.manage");
  if (!Types.ObjectId.isValid(productId)) throw new AppError("NOT_FOUND", "Product not found.");
  await connectDB();
  const product = await Product.findById(productId).lean();
  if (!product) throw new AppError("NOT_FOUND", "Product not found.");
  const orders = await Order.countDocuments({ productId: product._id });
  if (orders > 0) {
    throw new AppError("INVALID_STATE", `This product has ${orders} order${orders === 1 ? "" : "s"}, so it can't be deleted. Archive it instead — it disappears from the store but history is kept.`);
  }
  await withTransaction(async (session) => {
    await Product.deleteOne({ _id: product._id }, { session });
    await Promotion.updateMany({ linkedProductIds: product._id }, { $pull: { linkedProductIds: product._id } }, { session });
    await audit(actor, "product.delete", "Product", productId, { session, metadata: { name: product.name, slug: product.slug, stockAtDeletion: product.stockQuantity } });
  });
  return { name: product.name };
}

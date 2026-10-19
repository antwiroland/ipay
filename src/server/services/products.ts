import { Types } from "mongoose";
import { z } from "zod";
import { cediAmountSchema } from "@/lib/validation";
import { InventoryMovement, Product } from "@/models";
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
  type: z.enum(["restock", "adjustment"]),
  quantity: z.coerce.number().int().refine((n) => n !== 0, "Quantity cannot be zero"),
  note: z.string().trim().min(3, "Add a note").max(300),
});

/** Restock or adjust inventory atomically; never allows stock below zero. */
export async function adjustStock(actor: Actor, productId: string, input: unknown) {
  requirePermission(actor, "products.manage");
  const data = parseOrThrow(stockSchema, input);
  if (data.type === "restock" && data.quantity < 0) throw new AppError("VALIDATION", "Restock quantity must be positive.");
  if (!Types.ObjectId.isValid(productId)) throw new AppError("NOT_FOUND", "Product not found.");
  return withTransaction(async (session) => {
    const filter: Record<string, unknown> = { _id: productId };
    if (data.quantity < 0) filter.stockQuantity = { $gte: -data.quantity };
    const p = await Product.findOneAndUpdate(filter, { $inc: { stockQuantity: data.quantity } }, { session, returnDocument: "after" });
    if (!p) throw new AppError("VALIDATION", "Stock cannot go below zero.");
    await InventoryMovement.create([{ productId: p._id, type: data.type, quantity: data.quantity, actorId: actor.userId, note: data.note, stockAfter: p.stockQuantity }], { session });
    await audit(actor, "inventory.adjust", "Product", productId, { session, reason: data.note, metadata: { quantity: data.quantity, stockAfter: p.stockQuantity } });
    return p;
  });
}

import { Types } from "mongoose";
import { z } from "zod";
import { isSafeDestination } from "@/lib/validation";
import { Product, Promotion } from "@/models";
import { type Actor, requirePermission } from "../auth/actor";
import { connectDB } from "../db";
import { AppError } from "../errors";
import { audit } from "./audit";
import { parseOrThrow } from "./auth";

const imagePath = z
  .string()
  .trim()
  .min(1, "Upload an image")
  .max(500)
  .refine((v) => v.startsWith("/") || v.startsWith("https://res.cloudinary.com/"), "Use an uploaded image");

export const promotionInputSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    subtitle: z.string().trim().max(300).default(""),
    badge: z.string().trim().max(40).nullish(),
    desktopImage: imagePath,
    mobileImage: imagePath,
    callToAction: z.string().trim().min(2).max(40),
    destinationType: z.enum(["url", "product"]),
    destination: z.string().trim().min(1).max(300),
    linkedProductIds: z.array(z.string().regex(/^[a-f0-9]{24}$/)).max(20).default([]),
    discountPercent: z.coerce.number().min(0).max(50).default(0),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    status: z.enum(["draft", "published", "archived"]),
    displayOrder: z.coerce.number().int().min(0).max(100).default(0),
    showCountdown: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.endDate <= v.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "Campaign must end after it starts" });
    if (v.destinationType === "url" && !isSafeDestination(v.destination)) {
      ctx.addIssue({ code: "custom", path: ["destination"], message: "Use an internal path like /shop or an allow-listed https URL" });
    }
    if (v.destinationType === "product" && !/^[a-z0-9-]{1,120}$/.test(v.destination)) {
      ctx.addIssue({ code: "custom", path: ["destination"], message: "Choose a product" });
    }
  });

export async function savePromotion(actor: Actor, id: string | null, input: unknown) {
  requirePermission(actor, "promotions.manage");
  const data = parseOrThrow(promotionInputSchema, input);
  await connectDB();
  if (data.destinationType === "product") {
    const exists = await Product.exists({ slug: data.destination });
    if (!exists) throw new AppError("VALIDATION", "The linked product does not exist.", { fieldErrors: { destination: ["Unknown product"] } });
  }
  const { discountPercent, ...rest } = data;
  const doc = { ...rest, discountBps: Math.round(discountPercent * 100), linkedProductIds: rest.linkedProductIds.map((x) => new Types.ObjectId(x)) };
  if (!id) {
    const p = await Promotion.create({ ...doc, createdBy: actor.userId });
    await audit(actor, "promotion.create", "Promotion", p._id.toString(), { metadata: { title: p.title, status: p.status } });
    return p;
  }
  const p = await Promotion.findByIdAndUpdate(id, { $set: doc }, { returnDocument: "after", runValidators: true });
  if (!p) throw new AppError("NOT_FOUND", "Campaign not found.");
  await audit(actor, "promotion.update", "Promotion", id, { metadata: { title: p.title, status: p.status } });
  return p;
}

export async function setPromotionStatus(actor: Actor, id: string, status: "draft" | "published" | "archived") {
  requirePermission(actor, "promotions.manage");
  await connectDB();
  const p = await Promotion.findByIdAndUpdate(id, { $set: { status } }, { returnDocument: "after" });
  if (!p) throw new AppError("NOT_FOUND", "Campaign not found.");
  await audit(actor, `promotion.${status}`, "Promotion", id, { metadata: { title: p.title } });
  return p;
}

export async function reorderPromotions(actor: Actor, orderedIds: string[]) {
  requirePermission(actor, "promotions.manage");
  await connectDB();
  await Promise.all(orderedIds.map((id, i) => Promotion.updateOne({ _id: id }, { $set: { displayOrder: i } })));
  await audit(actor, "promotion.reorder", "Promotion", null, { metadata: { orderedIds } });
}

/** Banners eligible for the public homepage right now. */
export async function liveBanners(now = new Date()) {
  await connectDB();
  return Promotion.find({ status: "published", startDate: { $lte: now }, endDate: { $gte: now } })
    .sort({ displayOrder: 1, startDate: -1 })
    .limit(6)
    .lean();
}

export async function trackPromotion(id: string, kind: "impression" | "click") {
  if (!Types.ObjectId.isValid(id)) return null;
  await connectDB();
  return Promotion.findOneAndUpdate(
    { _id: id, status: "published" },
    { $inc: kind === "click" ? { clicks: 1 } : { impressions: 1 } },
    { returnDocument: "after" },
  ).lean();
}

export function promotionHref(p: { destinationType: string; destination: string }) {
  return p.destinationType === "product" ? `/products/${p.destination}` : p.destination;
}

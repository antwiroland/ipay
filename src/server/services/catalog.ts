import { Types } from "mongoose";
import { effectiveCashPrice, effectiveInstallmentPrice, quote, type PricingPlan } from "@/lib/pricing";
import { escapeRegex } from "@/lib/validation";
import { PaymentPlan, Product, Promotion, type IPaymentPlan, type IProduct } from "@/models";
import { connectDB } from "../db";
import { getSettings } from "./settings";

export function planToPricing(p: IPaymentPlan): PricingPlan {
  return {
    purchaseModel: p.purchaseModel,
    depositType: p.depositType,
    depositValue: p.depositValue,
    frequency: p.frequency,
    numberOfInstallments: p.numberOfInstallments,
    markupBps: p.markupBps,
    fees: p.fees.map((f) => ({ name: f.name, amount: f.amount })),
    dueDayOfMonth: p.dueDayOfMonth ?? null,
  };
}

/** Published campaigns currently live. */
export async function activeCampaigns(now = new Date()) {
  await connectDB();
  return Promotion.find({ status: "published", startDate: { $lte: now }, endDate: { $gte: now } })
    .sort({ displayOrder: 1, startDate: -1 })
    .lean();
}

export async function campaignDiscountFor(productId: Types.ObjectId | string, now = new Date()) {
  const campaigns = await Promotion.find({
    status: "published",
    startDate: { $lte: now },
    endDate: { $gte: now },
    linkedProductIds: new Types.ObjectId(String(productId)),
    discountBps: { $gt: 0 },
  })
    .sort({ discountBps: -1 })
    .limit(1)
    .lean();
  return campaigns[0] ? { discountBps: campaigns[0].discountBps, campaignId: campaigns[0]._id.toString(), title: campaigns[0].title } : null;
}

/** Active plans available for a product, honouring purchase-model switches in settings. */
export async function plansForProduct(product: Pick<IProduct, "planIds">) {
  await connectDB();
  const settings = await getSettings();
  const filter: Record<string, unknown> = { isActive: true };
  if (product.planIds?.length) filter._id = { $in: product.planIds };
  const plans = await PaymentPlan.find(filter).sort({ sortOrder: 1, numberOfInstallments: 1 }).lean();
  return plans.filter((p) => settings.purchaseModels[p.purchaseModel]?.enabled !== false);
}

export type CatalogFilters = {
  q?: string;
  series?: number;
  condition?: "brand_new" | "uk_used";
  storage?: number;
  minPrice?: number; // pesewas
  maxPrice?: number;
  availability?: "in_stock" | "all";
  duration?: number; // number of installments
  sort?: "featured" | "price_asc" | "price_desc" | "newest";
  featured?: boolean;
  page?: number;
  pageSize?: number;
};

export interface CatalogCard {
  id: string;
  slug: string;
  name: string;
  model: string;
  storage: string;
  condition: IProduct["condition"];
  colours: { name: string; hex: string }[];
  image: string;
  imageAlt: string;
  cashPrice: number;
  installmentPrice: number;
  listInstallmentPrice: number;
  promoApplied: boolean;
  deposit: number;
  indicativeInstallment: number;
  indicativeFrequency: "weekly" | "monthly";
  indicativeCount: number;
  inStock: boolean;
  stock: number;
  isFeatured: boolean;
  createdAt: string;
  durations: number[];
}

/** Best live campaign discount per product id, loaded in one query. */
export async function campaignDiscountMap(now = new Date()) {
  const campaigns = await Promotion.find({
    status: "published",
    startDate: { $lte: now },
    endDate: { $gte: now },
    discountBps: { $gt: 0 },
  }).lean();
  const map = new Map<string, { discountBps: number }>();
  for (const c of campaigns) {
    for (const id of c.linkedProductIds) {
      const k = id.toString();
      if ((map.get(k)?.discountBps ?? 0) < c.discountBps) map.set(k, { discountBps: c.discountBps });
    }
  }
  return map;
}

export function toCard(
  p: IProduct,
  plans: IPaymentPlan[],
  campaign: { discountBps: number } | null | undefined,
  now = new Date(),
): CatalogCard {
  const applicable = plans.filter((pl) => !p.planIds?.length || p.planIds.some((id) => id.equals(pl._id)));
  // Indicative plan: longest weekly plan (lowest regular payment) for display; fallback to first.
  const indicativePlan =
    [...applicable].sort((a, b) => b.numberOfInstallments - a.numberOfInstallments).find((x) => x.frequency === "weekly") ??
    applicable[0];
  const q = indicativePlan ? quote(p, planToPricing(indicativePlan), { now, campaign }) : null;
  const { price, promoApplied } = effectiveInstallmentPrice(p, now, campaign);
  return {
    id: p._id.toString(),
    slug: p.slug,
    name: p.name,
    model: p.model,
    storage: p.storage,
    condition: p.condition,
    colours: p.colourOptions ?? [],
    image: p.images?.[0]?.url ?? "/images/devices/placeholder.svg",
    imageAlt: p.images?.[0]?.alt || p.name,
    cashPrice: effectiveCashPrice(p, now),
    installmentPrice: price,
    listInstallmentPrice: p.installmentPrice,
    promoApplied,
    deposit: q?.deposit ?? 0,
    indicativeInstallment: q?.regularInstallment ?? 0,
    indicativeFrequency: indicativePlan?.frequency ?? "weekly",
    indicativeCount: indicativePlan?.numberOfInstallments ?? 0,
    inStock: p.isAvailable && p.stockQuantity > 0,
    stock: p.stockQuantity,
    isFeatured: p.isFeatured,
    createdAt: p.createdAt.toISOString(),
    durations: [...new Set(applicable.map((x) => x.numberOfInstallments))].sort((a, b) => a - b),
  };
}

export async function listCatalog(filters: CatalogFilters = {}) {
  await connectDB();
  const now = new Date();
  const query: Record<string, unknown> = { isPublished: true, isArchived: false };
  if (filters.q) {
    const rx = new RegExp(escapeRegex(filters.q.slice(0, 60)), "i");
    query.$or = [{ name: rx }, { model: rx }];
  }
  if (filters.series) query.series = filters.series;
  if (filters.condition) query.condition = filters.condition;
  if (filters.storage) query.storageGb = filters.storage;
  if (filters.featured) query.isFeatured = true;
  if (filters.availability === "in_stock") {
    query.isAvailable = true;
    query.stockQuantity = { $gt: 0 };
  }

  const settings = await getSettings();
  const allPlans = (await PaymentPlan.find({ isActive: true }).lean()).filter(
    (p) => settings.purchaseModels[p.purchaseModel]?.enabled !== false,
  );
  const [products, discounts] = await Promise.all([Product.find(query).lean(), campaignDiscountMap(now)]);
  let cards = products.map((p) => toCard(p, allPlans, discounts.get(p._id.toString()), now));

  // Price/duration filters run on effective prices (promotions included).
  if (filters.minPrice != null) cards = cards.filter((c) => c.installmentPrice >= filters.minPrice!);
  if (filters.maxPrice != null) cards = cards.filter((c) => c.installmentPrice <= filters.maxPrice!);
  if (filters.duration) cards = cards.filter((c) => c.durations.includes(filters.duration!));

  switch (filters.sort) {
    case "price_asc":
      cards.sort((a, b) => a.installmentPrice - b.installmentPrice);
      break;
    case "price_desc":
      cards.sort((a, b) => b.installmentPrice - a.installmentPrice);
      break;
    case "newest":
      cards.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
    default:
      cards.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || Number(b.inStock) - Number(a.inStock) || b.createdAt.localeCompare(a.createdAt));
  }

  const pageSize = Math.min(48, filters.pageSize ?? 24);
  const page = Math.max(1, filters.page ?? 1);
  const total = cards.length;
  return { items: cards.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
}

export async function catalogFacets() {
  await connectDB();
  const base = { isPublished: true, isArchived: false };
  const [series, storage, durations] = await Promise.all([
    Product.distinct("series", base),
    Product.distinct("storageGb", base),
    PaymentPlan.distinct("numberOfInstallments", { isActive: true }),
  ]);
  return {
    series: (series as number[]).sort((a, b) => b - a),
    storage: (storage as number[]).sort((a, b) => a - b),
    durations: (durations as number[]).sort((a, b) => a - b),
  };
}

export async function getProductBySlug(slug: string) {
  await connectDB();
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const product = await Product.findOne({ slug, isPublished: true, isArchived: false }).lean();
  if (!product) return null;
  const [plans, campaign] = await Promise.all([plansForProduct(product), campaignDiscountFor(product._id)]);
  return { product, plans, campaign };
}

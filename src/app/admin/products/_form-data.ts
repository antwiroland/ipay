import type { ProductFormValues } from "@/components/admin/product-form";
import { pesewasToCedisString } from "@/lib/money";
import { PaymentPlan, type IProduct } from "@/models";

const local = (d?: Date | null) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

export function toFormValues(p?: IProduct | null): ProductFormValues {
  return {
    name: p?.name ?? "",
    slug: p?.slug ?? "",
    description: p?.description ?? "",
    model: p?.model ?? "",
    series: p ? String(p.series) : "",
    storage: p?.storage ?? "128GB",
    condition: p?.condition ?? "brand_new",
    colourOptions: p?.colourOptions.map((c) => ({ name: c.name, hex: c.hex })) ?? [],
    images: p?.images.map((i) => ({ url: i.url, alt: i.alt, publicId: i.publicId ?? null })) ?? [],
    specs: p?.specs.map((s) => ({ label: s.label, value: s.value })) ?? [],
    cashPrice: p ? pesewasToCedisString(p.cashPrice) : "",
    installmentPrice: p ? pesewasToCedisString(p.installmentPrice) : "",
    costPrice: p ? pesewasToCedisString(p.costPrice) : "",
    promoCashPrice: p?.promoCashPrice != null ? pesewasToCedisString(p.promoCashPrice) : "",
    promoInstallmentPrice: p?.promoInstallmentPrice != null ? pesewasToCedisString(p.promoInstallmentPrice) : "",
    promoStartsAt: local(p?.promoStartsAt),
    promoEndsAt: local(p?.promoEndsAt),
    addOns: p?.addOns.map((a) => ({ key: a.key, name: a.name, price: pesewasToCedisString(a.price) })) ?? [],
    planIds: p?.planIds.map((id) => id.toString()) ?? [],
    isFeatured: p?.isFeatured ?? false,
    isPublished: p?.isPublished ?? false,
    isAvailable: p?.isAvailable ?? true,
  };
}

export async function planOptions() {
  const plans = await PaymentPlan.find({ isActive: true }).sort({ sortOrder: 1 }).lean();
  return plans.map((p) => ({
    id: p._id.toString(),
    name: p.name,
    purchaseModel: p.purchaseModel,
    depositType: p.depositType,
    depositValue: p.depositValue,
    frequency: p.frequency,
    numberOfInstallments: p.numberOfInstallments,
    markupBps: p.markupBps,
    fees: p.fees.map((f) => ({ name: f.name, amount: f.amount })),
  }));
}

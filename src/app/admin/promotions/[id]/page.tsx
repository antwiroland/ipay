import { Types } from "mongoose";
import { notFound } from "next/navigation";
import { PromotionForm, type PromotionFormValues } from "@/components/admin/promotion-form";
import { PageHeader } from "@/components/ui/primitives";
import { Product, Promotion, type IPromotion } from "@/models";
import { requireStaffPage } from "@/server/auth/session";

export const metadata = { title: "Campaign" };

const local = (d?: Date | null) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

function toValues(p: IPromotion | null): PromotionFormValues {
  const now = new Date();
  return {
    title: p?.title ?? "",
    subtitle: p?.subtitle ?? "",
    badge: p?.badge ?? "",
    desktopImage: p?.desktopImage ?? "",
    mobileImage: p?.mobileImage ?? "",
    callToAction: p?.callToAction ?? "Shop now",
    destinationType: p?.destinationType ?? "url",
    destination: p?.destination ?? "/shop",
    linkedProductIds: p?.linkedProductIds.map((x) => x.toString()) ?? [],
    discountPercent: String((p?.discountBps ?? 0) / 100),
    startDate: local(p?.startDate ?? now),
    endDate: local(p?.endDate ?? new Date(now.getTime() + 14 * 86400000)),
    status: p?.status ?? "draft",
    displayOrder: String(p?.displayOrder ?? 0),
    showCountdown: p?.showCountdown ?? false,
  };
}

export default async function PromotionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaffPage("promotions.manage", `/admin/promotions/${id}`);
  const isNew = id === "new";
  if (!isNew && !Types.ObjectId.isValid(id)) notFound();
  const [promo, products] = await Promise.all([isNew ? null : Promotion.findById(id).lean(), Product.find({ isArchived: false }).select("name slug").sort({ series: -1 }).lean()]);
  if (!isNew && !promo) notFound();
  return (
    <div>
      <PageHeader title={promo ? promo.title : "New campaign"} />
      <PromotionForm id={isNew ? null : id} initial={toValues(promo)} products={products.map((p) => ({ id: p._id.toString(), slug: p.slug, name: p.name }))} />
    </div>
  );
}

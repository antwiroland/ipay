import { ChevronRight, PackageCheck, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlanCalculator, type CalcPlan, type Viewer } from "@/components/store/plan-calculator";
import { ProductColourProvider } from "@/components/store/product-colour";
import { ProductGallery } from "@/components/store/product-gallery";
import { Badge } from "@/components/ui/badge";
import { formatGHS } from "@/lib/money";
import { effectiveCashPrice } from "@/lib/pricing";
import { isStaffRole } from "@/lib/permissions";
import { User } from "@/models";
import { getActor } from "@/server/auth/session";
import { getProductBySlug } from "@/server/services/catalog";
import { getActiveOrder } from "@/server/services/orders";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProductBySlug(slug);
  if (!data) return { title: "Product not found" };
  return {
    title: `${data.product.name} on installments`,
    description: `${data.product.name} (${data.product.condition === "brand_new" ? "brand new" : "UK used"}) from iPay Ghana. ${data.product.description}`,
    openGraph: { images: data.product.images?.[0]?.url ? [data.product.images[0].url] : [] },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getProductBySlug(slug);
  if (!data) notFound();
  const { product, plans, campaign } = data;

  const actor = await getActor().catch(() => null);
  let viewer: Viewer = { kind: "guest" };
  if (actor && isStaffRole(actor.role)) viewer = { kind: "staff" };
  else if (actor) {
    const [active, user] = await Promise.all([getActiveOrder(actor.userId), User.findById(actor.userId).select("verificationStatus").lean()]);
    viewer = { kind: "customer", activeOrderId: active?._id.toString() ?? null, verificationStatus: user?.verificationStatus ?? "unverified" };
  }

  const calcPlans: CalcPlan[] = plans.map((p) => ({
    id: p._id.toString(),
    name: p.name,
    description: p.description,
    purchaseModel: p.purchaseModel,
    depositType: p.depositType,
    depositValue: p.depositValue,
    frequency: p.frequency,
    numberOfInstallments: p.numberOfInstallments,
    markupBps: p.markupBps,
    fees: p.fees.map((f) => ({ name: f.name, amount: f.amount })),
    dueDayOfMonth: p.dueDayOfMonth ?? null,
    termsVersion: p.termsVersion,
    termsText: p.termsText,
    gracePeriodDays: p.gracePeriodDays,
    latePaymentPolicy: p.latePaymentPolicy,
    allowPartialPayments: p.allowPartialPayments,
    allowAdditionalPayments: p.allowAdditionalPayments,
    requiresVerification: p.eligibility.requiresVerification,
    requiresApproval: p.eligibility.requiresApproval,
  }));

  const pricing = {
    cashPrice: product.cashPrice,
    installmentPrice: product.installmentPrice,
    promoInstallmentPrice: product.promoInstallmentPrice ?? null,
    promoCashPrice: product.promoCashPrice ?? null,
    promoStartsAt: product.promoStartsAt?.toISOString() ?? null,
    promoEndsAt: product.promoEndsAt?.toISOString() ?? null,
    addOns: product.addOns.map((a) => ({ key: a.key, name: a.name, price: a.price })),
  };
  const inStock = product.isAvailable && product.stockQuantity > 0;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    itemCondition: product.condition === "brand_new" ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
    offers: { "@type": "Offer", priceCurrency: "GHS", price: (effectiveCashPrice(product) / 100).toFixed(2), availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1 text-[13px] text-muted">
        <Link href="/shop" className="hover:text-foreground">Shop</Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground">{product.name}</span>
      </nav>

      <ProductColourProvider initial={product.colourOptions[0]?.name ?? ""}>
        <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr]">
          <ProductGallery images={product.images.map((i) => ({ url: i.url, alt: i.alt }))} name={product.name} />

          <div className="flex flex-col gap-6">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge tone={product.condition === "brand_new" ? "dark" : "neutral"}>{product.condition === "brand_new" ? "Brand new" : "UK used"}</Badge>
                <Badge tone={inStock ? "success" : "grey"} dot>{inStock ? (product.stockQuantity <= 3 ? `Only ${product.stockQuantity} left` : "In stock") : "Out of stock"}</Badge>
              </div>
              <h1 className="mt-3 text-[32px] leading-tight font-semibold tracking-tight sm:text-[40px]">{product.name}</h1>
              <p className="mt-3 text-[15.5px] leading-relaxed text-muted">{product.description}</p>
              <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-3">
                <div>
                  <p className="text-[12.5px] text-muted">Installment price from</p>
                  <p className="tabular text-2xl font-semibold">{formatGHS(Math.min(...[product.installmentPrice, product.promoInstallmentPrice ?? Infinity].filter(Number.isFinite)))}</p>
                </div>
                <div>
                  <p className="text-[12.5px] text-muted">Cash price</p>
                  <p className="tabular text-lg font-medium text-muted">{formatGHS(effectiveCashPrice(product))}</p>
                </div>
              </div>
            </div>

            <PlanCalculator
              product={pricing}
              productId={product._id.toString()}
              slug={product.slug}
              plans={calcPlans}
              colours={product.colourOptions.map((c) => ({ name: c.name, hex: c.hex }))}
              campaign={campaign ? { discountBps: campaign.discountBps, title: campaign.title } : null}
              inStock={inStock}
              viewer={viewer}
            />

            <ul className="grid gap-3 sm:grid-cols-2">
              {[
                [<ShieldCheck key="a" />, "Inspected & tested", product.condition === "brand_new" ? "Sealed, brand new device" : "Graded by our technicians"],
                [<PackageCheck key="b" />, "Collect in store", "Accra store or partner location"],
                [<Truck key="c" />, "Delivery available", "Selected areas, on request"],
                [<RotateCcw key="d" />, "7-day support", "Help with setup and data transfer"],
              ].map(([icon, t, d]) => (
                <li key={String(t)} className="flex gap-3 rounded-[14px] border border-border bg-surface p-3.5">
                  <span className="text-accent [&_svg]:size-5">{icon}</span>
                  <span>
                    <span className="block text-sm font-medium">{t}</span>
                    <span className="block text-[12.5px] text-muted">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </ProductColourProvider>

      <section className="mt-16 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Technical specifications</h2>
          <dl className="mt-4 divide-y divide-border rounded-[16px] border border-border bg-surface">
            {[{ label: "Model", value: product.model }, { label: "Storage", value: product.storage }, { label: "Colours", value: product.colourOptions.map((c) => c.name).join(", ") }, ...product.specs].map((s) => (
              <div key={s.label} className="grid grid-cols-[140px_1fr] gap-4 px-4 py-3 text-sm">
                <dt className="text-muted">{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Terms in brief</h2>
          <div className="mt-4 space-y-3 rounded-[16px] border border-border bg-surface p-5 text-[14px] leading-relaxed text-muted">
            <p><strong className="text-foreground">Cash price</strong> is what you pay if you buy outright in store. <strong className="text-foreground">Installment price</strong> is the total you pay across a plan, before any plan-specific financing charge or fees, which are shown in the breakdown above.</p>
            <p>Your agreed price, deposit, schedule and terms are fixed when you apply and never change if our prices change later.</p>
            <p>You can hold one active installment plan at a time. Read the full <Link className="text-accent hover:underline" href="/terms">terms and conditions</Link>.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

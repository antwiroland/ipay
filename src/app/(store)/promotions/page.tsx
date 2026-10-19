import { ArrowRight, Tag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/store/product-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { formatDate } from "@/lib/dates";
import { listCatalog } from "@/server/services/catalog";
import { liveBanners } from "@/server/services/promotions";

export const metadata: Metadata = { title: "Promotions" };
export const dynamic = "force-dynamic";

export default async function PromotionsPage() {
  const [banners, catalog] = await Promise.all([liveBanners(), listCatalog({ pageSize: 48 })]);
  const onOffer = catalog.items.filter((p) => p.promoApplied);
  return (
    <div className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8">
      <h1 className="text-[36px] font-semibold tracking-tight">Promotions</h1>
      <p className="mt-2 text-[15px] text-muted">Live offers from iPay Ghana. Offer prices apply to applications submitted while the offer is running.</p>
      {banners.length === 0 && onOffer.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={<Tag />}
          title="No promotions right now"
          description="Check back soon, or join our mailing list in the footer to hear first."
          action={<Button asChild><Link href="/shop">Browse iPhones</Link></Button>}
        />
      ) : (
        <>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {banners.map((b) => (
              <Link key={b._id.toString()} href={`/api/promotions/${b._id}/click`} className="group relative overflow-hidden rounded-[20px] bg-foreground p-7 text-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.desktopImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
                <div className="relative">
                  {b.badge && <Badge className="border-white/20 bg-white/10 text-white">{b.badge}</Badge>}
                  <h2 className="mt-3 text-2xl font-semibold">{b.title}</h2>
                  <p className="mt-2 max-w-md text-sm text-white/75">{b.subtitle}</p>
                  <p className="mt-4 text-[12px] text-white/60">Ends {formatDate(b.endDate)}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium">
                    {b.callToAction} <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
          {onOffer.length > 0 && (
            <>
              <h2 className="mt-14 mb-6 text-2xl font-semibold tracking-tight">iPhones on offer</h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {onOffer.map((p) => (
                  <ProductCard key={p.id} p={p} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

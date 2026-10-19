import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProductCard } from "@/components/store/product-card";
import { ShopFilters } from "@/components/store/shop-filters";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { listCatalog, catalogFacets, type CatalogFilters } from "@/server/services/catalog";

export const metadata: Metadata = { title: "Shop iPhones", description: "Browse brand new and UK-used iPhones available on installment plans in Ghana." };
export const dynamic = "force-dynamic";

const int = (v: string | string[] | undefined) => {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
};
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const condition = str(sp.condition);
  const sort = str(sp.sort);
  const filters: CatalogFilters = {
    q: str(sp.q),
    series: int(sp.series),
    storage: int(sp.storage),
    condition: condition === "brand_new" || condition === "uk_used" ? condition : undefined,
    maxPrice: int(sp.max) ? int(sp.max)! * 100 : undefined,
    minPrice: int(sp.min) ? int(sp.min)! * 100 : undefined,
    availability: str(sp.availability) === "in_stock" ? "in_stock" : "all",
    duration: int(sp.duration),
    sort: sort === "price_asc" || sort === "price_desc" || sort === "newest" ? sort : "featured",
    page: int(sp.page) ?? 1,
    pageSize: 12,
  };
  const [result, facets] = await Promise.all([listCatalog(filters), catalogFacets()]);
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const pageHref = (p: number) => {
    const q = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (v ? [[k, String(v)]] : [])));
    q.set("page", String(p));
    return `/shop?${q.toString()}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-[32px] font-semibold tracking-tight sm:text-[40px]">Shop iPhones</h1>
        <p className="mt-1 text-[15px] text-muted">Brand new and inspected UK-used iPhones, all available on flexible installment plans.</p>
      </div>
      <Suspense>
        <ShopFilters {...facets} />
      </Suspense>
      <p className="mt-6 mb-4 text-sm text-muted" aria-live="polite">
        {result.total} {result.total === 1 ? "iPhone" : "iPhones"} found
      </p>
      {result.items.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title="No iPhones match these filters"
          description="Try removing a filter or searching for a different model."
          action={
            <Button variant="outline" asChild>
              <Link href="/shop">Clear filters</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {result.items.map((p, i) => (
            <ProductCard key={p.id} p={p} priority={i < 4} />
          ))}
        </div>
      )}
      {pages > 1 && (
        <nav className="mt-10 flex justify-center gap-2" aria-label="Pagination">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Button key={p} size="sm" variant={p === result.page ? "primary" : "outline"} asChild>
              <Link href={pageHref(p)} aria-current={p === result.page ? "page" : undefined}>{p}</Link>
            </Button>
          ))}
        </nav>
      )}
    </div>
  );
}

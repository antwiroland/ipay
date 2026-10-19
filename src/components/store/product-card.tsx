import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatGHS } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CatalogCard } from "@/server/services/catalog";
import { ProductImage } from "./product-image";

export function ProductCard({ p, priority }: { p: CatalogCard; priority?: boolean }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[18px] border border-border bg-surface transition duration-300 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[var(--shadow-lift)]">
      <Link href={`/products/${p.slug}`} className="relative block aspect-[4/3.6] bg-[radial-gradient(120%_90%_at_50%_10%,#ffffff_0%,#f3f2ee_70%)]" aria-label={`${p.name} details`}>
        <ProductImage src={p.image} alt={p.imageAlt} priority={priority} className="p-6 transition duration-500 group-hover:scale-[1.03]" />
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <Badge tone={p.condition === "brand_new" ? "dark" : "neutral"} className={cn(p.condition !== "brand_new" && "bg-surface")}>
            {p.condition === "brand_new" ? "Brand new" : "UK used"}
          </Badge>
          {p.promoApplied && <Badge tone="accent">Offer</Badge>}
        </div>
        {!p.inStock && (
          <div className="absolute inset-x-3 bottom-3 rounded-lg bg-surface/90 py-1.5 text-center text-[12.5px] font-medium text-muted backdrop-blur">Out of stock</div>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[16px] font-semibold tracking-tight">
              <Link href={`/products/${p.slug}`} className="after:absolute after:inset-0 after:content-[''] focus:outline-none">
                {p.model}
              </Link>
            </h3>
            <p className="text-[13px] text-muted">{p.storage}</p>
          </div>
          {p.colours.length > 0 && (
            <div className="flex -space-x-1 pt-1" aria-label={`Colours: ${p.colours.map((c) => c.name).join(", ")}`}>
              {p.colours.slice(0, 4).map((c) => (
                <span key={c.name} title={c.name} className="size-3.5 rounded-full border-2 border-surface ring-1 ring-border" style={{ background: c.hex }} />
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="tabular text-[20px] font-semibold tracking-tight">{formatGHS(p.installmentPrice)}</span>
            {p.promoApplied && <span className="tabular text-[13px] text-subtle line-through">{formatGHS(p.listInstallmentPrice)}</span>}
          </div>
          <p className="text-[12.5px] text-muted">
            Installment price · Cash <span className="tabular">{formatGHS(p.cashPrice)}</span>
          </p>
        </div>

        {p.indicativeInstallment > 0 && (
          <div className="mt-4 rounded-[12px] bg-surface-2 px-3 py-2.5 text-[13px]">
            <p>
              <span className="tabular font-semibold">{formatGHS(p.deposit)}</span> <span className="text-muted">deposit, then</span>{" "}
              <span className="tabular font-semibold">{formatGHS(p.indicativeInstallment)}</span>
              <span className="text-muted">/{p.indicativeFrequency === "weekly" ? "week" : "month"}</span>
            </p>
            <p className="mt-0.5 text-[12px] text-subtle">Example on a {p.indicativeCount}-{p.indicativeFrequency === "weekly" ? "week" : "month"} plan</p>
          </div>
        )}

        <div className="relative z-10 mt-auto grid grid-cols-2 gap-2 pt-5">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/products/${p.slug}`}>View details</Link>
          </Button>
          <Button size="sm" asChild disabled={!p.inStock}>
            <Link href={`/products/${p.slug}#plans`} aria-disabled={!p.inStock}>
              {p.inStock ? "Buy on installments" : "Notify me"} <ArrowRight className="hidden sm:block" />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

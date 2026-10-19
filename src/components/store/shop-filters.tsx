"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/primitives";

export function ShopFilters({ series, storage, durations }: { series: number[]; storage: number[]; durations: number[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };
  const active = ["series", "condition", "storage", "min", "max", "availability", "duration", "q"].filter((k) => params.get(k));

  return (
    <div className="rounded-[16px] border border-border bg-surface p-4" aria-busy={pending}>
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal className="size-4" /> Filters
        </p>
        {active.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => start(() => router.replace(pathname, { scroll: false }))}>
            <X /> Clear
          </Button>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="f-q">Search</Label>
          <Input
            id="f-q"
            defaultValue={params.get("q") ?? ""}
            placeholder="e.g. 15 Pro"
            onKeyDown={(e) => e.key === "Enter" && set("q", (e.target as HTMLInputElement).value.trim())}
            onBlur={(e) => e.target.value.trim() !== (params.get("q") ?? "") && set("q", e.target.value.trim())}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-series">Model</Label>
          <Select id="f-series" value={params.get("series") ?? ""} onChange={(e) => set("series", e.target.value)}>
            <option value="">All models</option>
            {series.map((s) => (
              <option key={s} value={s}>iPhone {s}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-cond">Condition</Label>
          <Select id="f-cond" value={params.get("condition") ?? ""} onChange={(e) => set("condition", e.target.value)}>
            <option value="">Any</option>
            <option value="brand_new">Brand new</option>
            <option value="uk_used">UK used</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-storage">Storage</Label>
          <Select id="f-storage" value={params.get("storage") ?? ""} onChange={(e) => set("storage", e.target.value)}>
            <option value="">Any</option>
            {storage.map((s) => (
              <option key={s} value={s}>{s >= 1024 ? `${s / 1024}TB` : `${s}GB`}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-price">Max price</Label>
          <Select id="f-price" value={params.get("max") ?? ""} onChange={(e) => set("max", e.target.value)}>
            <option value="">Any</option>
            {[6000, 10000, 15000, 20000, 25000].map((v) => (
              <option key={v} value={v}>Up to GH₵{v.toLocaleString()}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-dur">Plan length</Label>
          <Select id="f-dur" value={params.get("duration") ?? ""} onChange={(e) => set("duration", e.target.value)}>
            <option value="">Any</option>
            {durations.map((d) => (
              <option key={d} value={d}>{d} installments</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-sort">Sort by</Label>
          <Select id="f-sort" value={params.get("sort") ?? ""} onChange={(e) => set("sort", e.target.value)}>
            <option value="">Featured</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="newest">Newest arrivals</option>
          </Select>
        </div>
      </div>
      <label className="mt-3 inline-flex items-center gap-2 text-[13px] text-muted">
        <input type="checkbox" className="accent-[var(--accent)]" checked={params.get("availability") === "in_stock"} onChange={(e) => set("availability", e.target.checked ? "in_stock" : "")} />
        In stock only
      </label>
    </div>
  );
}

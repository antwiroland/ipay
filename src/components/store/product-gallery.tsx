"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ProductImage } from "./product-image";

export function ProductGallery({ images, name }: { images: { url: string; alt: string }[]; name: string }) {
  const [active, setActive] = useState(0);
  const list = images.length ? images : [{ url: "/images/devices/placeholder.svg", alt: name }];
  return (
    <div className="flex flex-col gap-3 lg:sticky lg:top-24">
      <div className="relative aspect-square overflow-hidden rounded-[24px] border border-border bg-[radial-gradient(120%_90%_at_50%_10%,#ffffff_0%,#f1f0ec_75%)]">
        <ProductImage src={list[active].url} alt={list[active].alt || name} priority sizes="(min-width: 1024px) 50vw, 100vw" className="p-8 sm:p-12" />
      </div>
      {list.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1" role="tablist" aria-label="Product images">
          {list.map((img, i) => (
            <button
              key={img.url}
              role="tab"
              aria-selected={i === active}
              aria-label={img.alt || `Image ${i + 1}`}
              onClick={() => setActive(i)}
              className={cn(
                "relative size-20 shrink-0 overflow-hidden rounded-[14px] border bg-surface transition",
                i === active ? "border-foreground ring-2 ring-foreground/10" : "border-border hover:border-border-strong",
              )}
            >
              <ProductImage src={img.url} alt="" sizes="80px" className="p-2" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

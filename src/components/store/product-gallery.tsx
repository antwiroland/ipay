"use client";

import { useState } from "react";
import { cn, imageForColour } from "@/lib/utils";
import { useProductColour } from "./product-colour";
import { ProductImage } from "./product-image";

export function ProductGallery({ images, name }: { images: { url: string; alt: string }[]; name: string }) {
  const list = images.length ? images : [{ url: "/images/devices/placeholder.svg", alt: name }];
  const [colour] = useProductColour("");
  const indexFor = (c: string) => Math.max(0, list.indexOf(imageForColour(list, c)!));
  // Follow the colour picked in the plan calculator; thumbnails can still browse freely.
  const [view, setView] = useState({ colour, active: indexFor(colour) });
  if (view.colour !== colour) setView({ colour, active: indexFor(colour) });
  const active = Math.min(view.active, list.length - 1);
  const setActive = (i: number) => setView({ colour, active: i });

  return (
    <div className="flex flex-col gap-3 lg:sticky lg:top-24">
      <div className="relative aspect-square overflow-hidden rounded-[24px] border border-border bg-[radial-gradient(120%_90%_at_50%_10%,#ffffff_0%,#f1f0ec_75%)]">
        <ProductImage key={list[active].url} src={list[active].url} alt={list[active].alt || name} priority sizes="(min-width: 1024px) 50vw, 100vw" className="animate-fade-in p-8 sm:p-12" />
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

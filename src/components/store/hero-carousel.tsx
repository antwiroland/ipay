"use client";

import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { trackImpressionAction } from "@/app/actions/public";
import { Button } from "@/components/ui/button";

export interface HeroSlide {
  id: string;
  title: string;
  subtitle: string;
  badge?: string | null;
  desktopImage: string;
  mobileImage: string;
  callToAction: string;
  href: string;
  endDate: string;
  showCountdown: boolean;
  productImage?: string | null;
}

function useCountdown(end: string) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, new Date(end).getTime() - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [end]);
  if (left == null) return null;
  const d = Math.floor(left / 86400000);
  const h = Math.floor((left % 86400000) / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return { d, h, m, s };
}

function Countdown({ end }: { end: string }) {
  const c = useCountdown(end);
  if (!c) return null;
  const cell = (v: number, l: string) => (
    <div className="min-w-12 rounded-lg bg-white/10 px-2 py-1.5 text-center backdrop-blur">
      <div className="tabular text-lg font-semibold">{String(v).padStart(2, "0")}</div>
      <div className="text-[10px] tracking-wider text-white/60 uppercase">{l}</div>
    </div>
  );
  return (
    <div className="mt-6 flex gap-2" aria-label="Offer ends in">
      {cell(c.d, "days")}
      {cell(c.h, "hrs")}
      {cell(c.m, "min")}
      {cell(c.s, "sec")}
    </div>
  );
}

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const seen = useRef(new Set<string>());
  const slide = slides[i];

  useEffect(() => {
    if (slides.length < 2 || paused) return;
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), 7000);
    return () => clearInterval(t);
  }, [slides.length, paused]);

  useEffect(() => {
    if (slide && !seen.current.has(slide.id) && !slide.id.startsWith("preview")) {
      seen.current.add(slide.id);
      void trackImpressionAction(slide.id);
    }
  }, [slide]);

  if (!slide) return null;
  return (
    <section
      className="relative overflow-hidden rounded-[24px] bg-foreground text-white"
      aria-roledescription="carousel"
      aria-label="Current promotions"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div key={slide.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="absolute inset-0">
          <picture>
            <source media="(min-width: 768px)" srcSet={slide.desktopImage} />
            <img src={slide.mobileImage} alt="" className="h-full w-full object-cover" />
          </picture>
        </motion.div>
      </AnimatePresence>

      <div className="relative grid min-h-[520px] items-center gap-6 px-6 py-12 sm:px-10 md:min-h-[460px] md:grid-cols-[1.1fr_1fr] lg:px-14">
        <AnimatePresence mode="wait">
          <motion.div key={slide.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.45 }}>
            {slide.badge && <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[12px] font-medium backdrop-blur">{slide.badge}</span>}
            <h2 className="mt-4 max-w-xl text-[34px] leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl">{slide.title}</h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/75">{slide.subtitle}</p>
            {slide.showCountdown && <Countdown end={slide.endDate} />}
            <div className="mt-8 flex flex-wrap gap-3">
              <Button variant="accent" size="lg" asChild>
                <Link href={`/api/promotions/${slide.id}/click`}>
                  {slide.callToAction} <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10" asChild>
                <Link href="/how-it-works">How it works</Link>
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
        {slide.productImage && (
          <div className="relative hidden h-[380px] md:block">
            <Image src={slide.productImage} alt="" fill unoptimized className="object-contain drop-shadow-[0_30px_40px_rgba(0,0,0,0.35)]" loading="eager" />
          </div>
        )}
      </div>

      {slides.length > 1 && (
        <div className="absolute right-5 bottom-5 flex items-center gap-2">
          <button className="grid size-9 place-items-center rounded-full bg-white/10 backdrop-blur hover:bg-white/20" onClick={() => setI((i - 1 + slides.length) % slides.length)} aria-label="Previous promotion">
            <ChevronLeft className="size-4" />
          </button>
          <div className="flex gap-1.5">
            {slides.map((s, idx) => (
              <button key={s.id} onClick={() => setI(idx)} aria-label={`Show promotion ${idx + 1}`} aria-current={idx === i} className={`h-1.5 rounded-full transition-all ${idx === i ? "w-6 bg-white" : "w-1.5 bg-white/40"}`} />
            ))}
          </div>
          <button className="grid size-9 place-items-center rounded-full bg-white/10 backdrop-blur hover:bg-white/20" onClick={() => setI((i + 1) % slides.length)} aria-label="Next promotion">
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </section>
  );
}

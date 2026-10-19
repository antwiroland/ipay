import { ArrowRight, BadgeCheck, CalendarClock, ChevronDown, Headphones, LineChart, LockKeyhole, ShieldCheck, Smartphone, Wallet } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { HeroCarousel, type HeroSlide } from "@/components/store/hero-carousel";
import { FAQS } from "@/components/store/faq-data";
import { ProductCard } from "@/components/store/product-card";
import { Button } from "@/components/ui/button";
import { formatGHS } from "@/lib/money";
import { Review } from "@/models";
import { listCatalog } from "@/server/services/catalog";
import { liveBanners, promotionHref } from "@/server/services/promotions";
import { getSettings } from "@/server/services/settings";
import { Product } from "@/models";

export const dynamic = "force-dynamic";

function Section({ eyebrow, title, description, action, children, id }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="mx-auto max-w-7xl px-4 pt-20 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {eyebrow && <p className="text-[13px] font-medium text-accent">{eyebrow}</p>}
          <h2 className="mt-1 text-[28px] font-semibold tracking-tight text-balance sm:text-[34px]">{title}</h2>
          {description && <p className="mt-2 max-w-2xl text-[15px] text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default async function HomePage() {
  const [featured, newest, banners, settings, reviews] = await Promise.all([
    listCatalog({ featured: true, pageSize: 4 }),
    listCatalog({ sort: "newest", pageSize: 4 }),
    liveBanners(),
    getSettings(),
    Review.find({ status: "approved" }).sort({ createdAt: -1 }).limit(3).lean(),
  ]);

  const linked = await Product.find({ _id: { $in: banners.flatMap((b) => b.linkedProductIds.slice(0, 1)) } }).select("images").lean();
  const slides: HeroSlide[] = banners.map((b) => ({
    id: b._id.toString(),
    title: b.title,
    subtitle: b.subtitle,
    badge: b.badge,
    desktopImage: b.desktopImage,
    mobileImage: b.mobileImage,
    callToAction: b.callToAction,
    href: promotionHref(b),
    endDate: b.endDate.toISOString(),
    showCountdown: b.showCountdown,
    productImage: linked.find((p) => p._id.equals(b.linkedProductIds[0]))?.images?.[0]?.url ?? null,
  }));

  const heroDevice = featured.items[0];

  return (
    <>
      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_75%_30%,#e6ebff_0%,transparent_70%),radial-gradient(40%_40%_at_10%_80%,#efe9ff_0%,transparent_70%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pt-12 pb-16 sm:px-6 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:px-8 lg:pt-20">
          <div className="animate-fade-up">
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[12.5px] font-medium text-muted shadow-sm">
              <span className="size-1.5 rounded-full bg-success" /> Your iPhone. Your Plan. Your Pace.
            </p>
            <h1 className="mt-5 text-[40px] leading-[1.02] font-semibold tracking-[-0.03em] text-balance sm:text-[56px] lg:text-[64px]">
              Own your next iPhone.{" "}
              <span className="bg-[linear-gradient(90deg,var(--accent),var(--violet))] bg-clip-text text-transparent">Pay in installments.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted">
              Get the iPhone you want with flexible installment plans designed around your budget. Track every payment and see exactly what you have left to pay.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/shop">
                  Shop iPhones <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/how-it-works">How it works</Link>
              </Button>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-border pt-6">
              <div>
                <dt className="text-[12.5px] text-muted">Deposits from</dt>
                <dd className="mt-0.5 text-lg font-semibold">10%</dd>
              </div>
              <div>
                <dt className="text-[12.5px] text-muted">Plans up to</dt>
                <dd className="mt-0.5 text-lg font-semibold">24 weeks</dd>
              </div>
              <div>
                <dt className="text-[12.5px] text-muted">Pay with</dt>
                <dd className="mt-0.5 text-lg font-semibold">MoMo & card</dd>
              </div>
            </dl>
          </div>

          <div className="relative mx-auto w-full max-w-[560px]">
            <div className="relative aspect-[16/15]">
              <Image src={heroDevice?.image ?? "/images/devices/placeholder.svg"} alt={heroDevice?.imageAlt ?? "iPhone"} fill loading="eager" fetchPriority="high" unoptimized className="object-contain" />
            </div>
            {heroDevice && (
              <div className="absolute bottom-6 left-0 w-60 animate-fade-up rounded-[16px] border border-border bg-surface/95 p-4 shadow-[var(--shadow-lift)] backdrop-blur [animation-delay:200ms] sm:-left-6">
                <p className="text-[12px] text-muted">Plan progress · {heroDevice.model}</p>
                <p className="tabular mt-1 text-lg font-semibold">60% paid</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full w-[60%] rounded-full bg-[linear-gradient(90deg,var(--accent),var(--violet))]" />
                </div>
                <p className="mt-2 text-[12px] text-muted">Next payment in 4 days</p>
              </div>
            )}
            <div className="absolute top-8 right-0 hidden animate-fade-up rounded-[14px] border border-border bg-surface/95 px-4 py-3 shadow-[var(--shadow-lift)] backdrop-blur [animation-delay:350ms] sm:block">
              <p className="flex items-center gap-2 text-[13px] font-medium">
                <BadgeCheck className="size-4 text-success" /> Payment confirmed
              </p>
              <p className="tabular text-[12px] text-muted">MoMo · just now</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Admin-managed promotions banner ---------------- */}
      {slides.length > 0 && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <HeroCarousel slides={slides} />
        </div>
      )}

      {/* ---------------- Trust strip ---------------- */}
      <div className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8">
        <ul className="grid gap-4 rounded-[18px] border border-border bg-surface p-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: <ShieldCheck />, t: "Genuine, inspected devices", d: "Brand new and graded UK-used iPhones." },
            { icon: <LockKeyhole />, t: "Secure, verified payments", d: "Mobile Money and card via a licensed provider." },
            { icon: <LineChart />, t: "Live balance tracking", d: "See every payment and what's left to pay." },
            { icon: <Wallet />, t: "No hidden charges", d: "Full price breakdown before you commit." },
          ].map((x) => (
            <li key={x.t} className="flex gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-accent-soft text-accent [&_svg]:size-5">{x.icon}</div>
              <div>
                <p className="text-sm font-semibold">{x.t}</p>
                <p className="text-[13px] text-muted">{x.d}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* ---------------- Featured ---------------- */}
      <Section
        eyebrow="Featured"
        title="Popular iPhones on installments"
        description="Every price below is live from our catalogue, including current offers."
        action={
          <Button variant="outline" asChild>
            <Link href="/shop">
              View all iPhones <ArrowRight />
            </Link>
          </Button>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featured.items.map((p, i) => (
            <ProductCard key={p.id} p={p} priority={i < 2} />
          ))}
        </div>
      </Section>

      {/* ---------------- How it works ---------------- */}
      <Section id="how" eyebrow="How it works" title="Two simple ways to own an iPhone" description="Choose the purchase model that fits your life. Both come with clear terms and live payment tracking.">
        <div className="grid gap-5 lg:grid-cols-2">
          {(
            [
              ["take_and_pay", "Take & Pay", <Smartphone key="i" />, ["Choose your iPhone and plan", "Get verified and approved", "Pay your deposit", "Take your iPhone home and pay the balance in installments"]],
              ["pay_small_small", "Pay Small-Small", <CalendarClock key="i" />, ["Choose your iPhone and plan", "Pay a small first contribution", "Keep contributing at your pace — we hold your device", "Collect your iPhone once it's fully paid"]],
            ] as const
          )
            .filter(([k]) => settings.purchaseModels[k]?.enabled !== false)
            .map(([key, title, icon, steps]) => (
              <div key={key} className="rounded-[20px] border border-border bg-surface p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <div className="grid size-11 place-items-center rounded-[12px] bg-foreground text-white [&_svg]:size-5">{icon}</div>
                  <div>
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <p className="text-[13px] text-muted">{settings.purchaseModels[key].summary}</p>
                  </div>
                </div>
                <ol className="mt-6 space-y-3">
                  {steps.map((s, i) => (
                    <li key={s} className="flex items-start gap-3 text-[14.5px]">
                      <span className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-[12px] font-semibold">{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
        </div>
      </Section>

      {/* ---------------- Worked example ---------------- */}
      <Section eyebrow="Transparent pricing" title="Know exactly what you'll pay">
        <div className="grid items-center gap-8 overflow-hidden rounded-[24px] bg-foreground p-6 text-white sm:p-10 lg:grid-cols-2">
          <div>
            <p className="text-[13px] text-white/60">Example · iPhone 13, 128GB · 12-week Take & Pay plan</p>
            <dl className="mt-6 space-y-3 text-[15px]">
              {[
                ["Installment purchase price", formatGHS(660000)],
                ["Deposit (40%)", formatGHS(264000)],
                ["Remaining balance", formatGHS(396000)],
                ["12 weekly installments of", formatGHS(33000)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b border-white/10 pb-3">
                  <dt className="text-white/70">{k}</dt>
                  <dd className="tabular font-semibold">{v}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1">
                <dt className="font-semibold">Total payable</dt>
                <dd className="tabular text-xl font-semibold">{formatGHS(660000)}</dd>
              </div>
            </dl>
            <p className="mt-4 text-[12.5px] text-white/50">Illustrative. Your exact figures are calculated live on each product page.</p>
          </div>
          <div className="rounded-[18px] bg-white/5 p-6 ring-1 ring-white/10">
            <p className="text-[13px] text-white/60">Your dashboard</p>
            <p className="tabular mt-2 text-4xl font-semibold">{formatGHS(264000)}</p>
            <p className="text-[13px] text-white/60">Outstanding balance</p>
            <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[60%] rounded-full bg-[linear-gradient(90deg,var(--accent),var(--violet))]" />
            </div>
            <div className="mt-3 flex justify-between text-[13px] text-white/70">
              <span className="tabular">{formatGHS(396000)} paid</span>
              <span>60%</span>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 text-[13px]">
              <div className="rounded-xl bg-white/5 p-3">
                <p className="text-white/60">Next payment</p>
                <p className="tabular mt-1 font-semibold">{formatGHS(33000)}</p>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <p className="text-white/60">Installments left</p>
                <p className="tabular mt-1 font-semibold">8 of 12</p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ---------------- New arrivals ---------------- */}
      <Section eyebrow="Just in" title="New arrivals">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {newest.items.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      </Section>

      {/* ---------------- Benefits ---------------- */}
      <Section eyebrow="Why iPay Ghana" title="Built for students, creators and young professionals">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Plans around your budget", "Weekly or monthly payments with deposits from as little as 10%."],
            ["Pay early, finish sooner", "Extra payments clear your next installments first. No penalties."],
            ["Every cedi accounted for", "Receipts for every payment and a live view of your balance."],
            ["Respectful support", "Real people on WhatsApp and phone. Struggling with a payment? Talk to us."],
            ["One plan at a time", "We'll never let you stack plans. Finish one, then upgrade."],
            ["Inspected UK-used devices", "Graded condition and battery health on every pre-owned iPhone."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-[18px] border border-border bg-surface p-6">
              <BadgeCheck className="size-5 text-accent" />
              <h3 className="mt-4 font-semibold">{t}</h3>
              <p className="mt-1 text-[14px] leading-relaxed text-muted">{d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------------- Reviews (only genuine, approved) ---------------- */}
      {reviews.length > 0 && (
        <Section eyebrow="Customers" title="What our customers say">
          <div className="grid gap-5 md:grid-cols-3">
            {reviews.map((r) => (
              <figure key={r._id.toString()} className="rounded-[18px] border border-border bg-surface p-6">
                <div className="text-accent" aria-label={`${r.rating} out of 5`}>{"★".repeat(r.rating)}<span className="text-border-strong">{"★".repeat(5 - r.rating)}</span></div>
                <blockquote className="mt-3 text-[15px] leading-relaxed">“{r.body}”</blockquote>
                <figcaption className="mt-4 text-[13px] text-muted">{r.displayName} · verified customer</figcaption>
              </figure>
            ))}
          </div>
        </Section>
      )}

      {/* ---------------- FAQ teaser ---------------- */}
      <Section eyebrow="FAQ" title="Questions, answered" action={<Button variant="outline" asChild><Link href="/faq">All FAQs</Link></Button>}>
        <div className="divide-y divide-border rounded-[18px] border border-border bg-surface">
          {FAQS.slice(0, 5).map((f) => (
            <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {f.q}
                <ChevronDown className="size-4 shrink-0 text-muted transition group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-[14.5px] leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* ---------------- Support ---------------- */}
      <section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-6 rounded-[24px] border border-border bg-[linear-gradient(135deg,#ffffff,#eef1ff)] p-8 sm:p-10 md:flex-row md:items-center">
          <div className="flex gap-4">
            <div className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-foreground text-white">
              <Headphones className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Need help choosing a plan?</h2>
              <p className="mt-1 text-[15px] text-muted">
                Call {settings.supportPhone} or WhatsApp {settings.supportWhatsapp}. We&apos;re here Monday to Saturday, 8am–7pm.
              </p>
            </div>
          </div>
          <Button size="lg" asChild>
            <Link href="/contact">Contact support</Link>
          </Button>
        </div>
      </section>
    </>
  );
}

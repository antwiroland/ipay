import { ArrowRight, CalendarCheck, CreditCard, PackageCheck, Search, ShieldCheck, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "How it works", description: "How iPay Ghana installment plans work: Take & Pay and Pay Small-Small." };
export const dynamic = "force-dynamic";

const STEPS = [
  { icon: Search, t: "Choose your iPhone", d: "Browse brand new and UK-used iPhones. Every product shows the cash price, the installment price and an example plan." },
  { icon: CalendarCheck, t: "Pick a plan", d: "Select weekly or monthly payments and see the full breakdown — deposit, each installment and the total payable — before you commit." },
  { icon: ShieldCheck, t: "Apply in minutes", d: "Create an account, accept the agreement and submit. Take & Pay plans include a quick identity check." },
  { icon: CreditCard, t: "Pay your deposit", d: "Pay securely with Mobile Money or card. Your schedule starts the moment your deposit is confirmed." },
  { icon: Smartphone, t: "Pay at your pace", d: "Make scheduled payments, pay extra or clear your balance early. Your dashboard updates after every confirmed payment." },
  { icon: PackageCheck, t: "Own it", d: "Take & Pay: collect your iPhone after approval and deposit. Pay Small-Small: collect it once fully paid." },
];

export default async function HowItWorksPage() {
  const s = await getSettings();
  return (
    <div className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 lg:px-8">
      <p className="text-[13px] font-medium text-accent">How it works</p>
      <h1 className="mt-1 text-[36px] font-semibold tracking-tight text-balance sm:text-[48px]">Own an iPhone without paying everything upfront</h1>
      <p className="mt-4 max-w-2xl text-[17px] text-muted">Two purchase models, one promise: clear terms, verified payments and a live view of what you have paid and what is left.</p>
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {s.purchaseModels.take_and_pay.enabled && (
          <div className="rounded-[20px] border border-border bg-surface p-6">
            <h2 className="text-xl font-semibold">Take & Pay</h2>
            <p className="mt-2 text-[15px] text-muted">{s.purchaseModels.take_and_pay.summary}</p>
            <p className="mt-4 text-[13px] text-muted">Best if you need your phone now. Requires identity verification and approval.</p>
          </div>
        )}
        {s.purchaseModels.pay_small_small.enabled && (
          <div className="rounded-[20px] border border-border bg-surface p-6">
            <h2 className="text-xl font-semibold">Pay Small-Small</h2>
            <p className="mt-2 text-[15px] text-muted">{s.purchaseModels.pay_small_small.summary}</p>
            <p className="mt-4 text-[13px] text-muted">Best for saving towards a device. Lower deposits; device released when fully paid.</p>
          </div>
        )}
      </div>
      <ol className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map(({ icon: Icon, t, d }, i) => (
          <li key={t} className="rounded-[18px] border border-border bg-surface p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-[12px] bg-foreground text-white"><Icon className="size-5" /></span>
              <span className="tabular text-[13px] font-medium text-muted">Step {i + 1}</span>
            </div>
            <h3 className="mt-4 font-semibold">{t}</h3>
            <p className="mt-1 text-[14.5px] leading-relaxed text-muted">{d}</p>
          </li>
        ))}
      </ol>
      <div className="mt-14 rounded-[20px] bg-foreground p-8 text-white sm:p-10">
        <h2 className="text-2xl font-semibold">Good to know</h2>
        <ul className="mt-5 grid gap-3 text-[15px] text-white/80 sm:grid-cols-2">
          <li>• One active plan at a time — finish one, then upgrade.</li>
          <li>• Payments settle your oldest installment first.</li>
          <li>• Pending or failed payments never reduce your balance.</li>
          <li>• Your agreed price never changes after you apply.</li>
          <li>• Grace period after each due date, no automatic late fees.</li>
          <li>• Receipts and statements available any time.</li>
        </ul>
        <Button variant="accent" size="lg" className="mt-8" asChild>
          <Link href="/shop">Shop iPhones <ArrowRight /></Link>
        </Button>
      </div>
    </div>
  );
}

import { ChevronDown } from "lucide-react";
import type { Metadata } from "next";
import { FAQS } from "@/components/store/faq-data";

export const metadata: Metadata = { title: "Frequently asked questions" };

export default function FaqPage() {
  const groups = [...new Set(FAQS.map((f) => f.group))];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <div className="mx-auto max-w-3xl px-4 pt-12 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <h1 className="text-[36px] font-semibold tracking-tight">Frequently asked questions</h1>
      <p className="mt-2 text-[15px] text-muted">Can&apos;t find your answer? Contact us — we&apos;re happy to help.</p>
      {groups.map((g) => (
        <section key={g} className="mt-10">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">{g}</h2>
          <div className="divide-y divide-border rounded-[18px] border border-border bg-surface">
            {FAQS.filter((f) => f.group === g).map((f) => (
              <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {f.q}
                  <ChevronDown className="size-4 shrink-0 text-muted transition group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-[14.5px] leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

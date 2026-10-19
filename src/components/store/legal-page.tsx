export function LegalPage({ title, updated, sections }: { title: string; updated: string; sections: { h: string; p: string[] }[] }) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-12 sm:px-6">
      <h1 className="text-[36px] font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted">Last updated {updated}</p>
      <div className="mt-6 rounded-[14px] border border-warning/25 bg-warning-soft p-4 text-[13px] text-[#7c3a06]">
        Template text for development. Have this document reviewed by qualified Ghanaian legal counsel before launch.
      </div>
      <div className="mt-8 space-y-8">
        {sections.map((s) => (
          <section key={s.h}>
            <h2 className="text-lg font-semibold">{s.h}</h2>
            {s.p.map((p) => (
              <p key={p.slice(0, 40)} className="mt-2 text-[15px] leading-relaxed text-muted">{p}</p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

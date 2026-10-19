import { BadgeCheck } from "lucide-react";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:py-20">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-[28px] font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] text-muted">{subtitle}</p>}
        <div className="mt-8">{children}</div>
        {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
      </div>
      <aside className="hidden overflow-hidden rounded-[24px] bg-foreground p-10 text-white lg:block">
        <p className="text-[13px] text-white/60">iPay Ghana</p>
        <h2 className="mt-3 text-3xl leading-tight font-semibold tracking-tight">Your iPhone. Your plan. Your pace.</h2>
        <ul className="mt-8 space-y-4 text-[15px] text-white/80">
          {["Clear prices and the total payable, up front", "Pay with Mobile Money or card", "See your balance update after every payment", "Receipts and statements whenever you need them"].map((t) => (
            <li key={t} className="flex gap-3">
              <BadgeCheck className="size-5 shrink-0 text-[#8ea2ff]" /> {t}
            </li>
          ))}
        </ul>
        <div className="mt-12 rounded-[18px] bg-white/5 p-5 ring-1 ring-white/10">
          <p className="text-[13px] text-white/60">Outstanding balance</p>
          <p className="tabular mt-1 text-3xl font-semibold">GH₵2,640.00</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-[60%] rounded-full bg-[linear-gradient(90deg,var(--accent),var(--violet))]" />
          </div>
          <p className="mt-2 text-[12px] text-white/50">Illustration</p>
        </div>
      </aside>
    </div>
  );
}

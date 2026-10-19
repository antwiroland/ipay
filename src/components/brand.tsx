import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <defs>
        <linearGradient id="lm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3355ff" />
          <stop offset="1" stopColor="#7c5cff" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="#0b1220" />
      <rect x="10" y="6" width="12" height="20" rx="3.5" fill="none" stroke="url(#lm)" strokeWidth="2" />
      <path d="M13 19.5l2.2 2.2 4.3-5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="14" y="8.4" width="4" height="1.4" rx=".7" fill="#fff" opacity=".7" />
    </svg>
  );
}

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5", className)} aria-label="iPay Ghana home">
      <LogoMark />
      <span className={cn("text-[17px] font-semibold tracking-tight", light ? "text-white" : "text-foreground")}>
        iPay <span className="font-normal text-muted">Ghana</span>
      </span>
    </Link>
  );
}

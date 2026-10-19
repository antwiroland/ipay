"use client";

import {
  BarChart3,
  Bell,
  CalendarClock,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Package,
  ScrollText,
  Settings,
  ShieldCheck,
  Store,
  Users,
  UserCog,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog as D } from "radix-ui";
import { useState } from "react";
import { LogoutButton } from "@/components/logout-button";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { SheetContent } from "@/components/ui/overlays";
import { cn, initials } from "@/lib/utils";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  badge?: number;
}

const ICONS = {
  overview: LayoutDashboard,
  customers: Users,
  products: Package,
  orders: ClipboardList,
  plans: Wallet,
  payments: CreditCard,
  installments: CalendarClock,
  promotions: Megaphone,
  notifications: Bell,
  reports: BarChart3,
  staff: UserCog,
  audit: ScrollText,
  settings: Settings,
  security: ShieldCheck,
};

function NavList({ items, onNavigate }: { items: AdminNavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5 p-3" aria-label="Admin">
      {items.map((i) => {
        const Icon = ICONS[i.icon];
        const active = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-[10px] px-3 py-2 text-[14px] transition",
              active ? "bg-white/10 font-medium text-white" : "text-white/65 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className="size-4" />
            {i.label}
            {!!i.badge && <span className="tabular ml-auto rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white">{i.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function Footer({ name, role }: { name: string; role: string }) {
  return (
    <div className="mt-auto border-t border-white/10 p-3">
      <Link href="/" className="mb-1 flex items-center gap-3 rounded-[10px] px-3 py-2 text-[14px] text-white/65 hover:bg-white/5 hover:text-white">
        <Store className="size-4" /> View storefront
      </Link>
      <div className="flex items-center gap-3 px-3 py-2">
        <span className="grid size-8 place-items-center rounded-full bg-white/10 text-[11px] font-semibold text-white">{initials(name)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-white">{name}</p>
          <p className="truncate text-[12px] text-white/50">{role}</p>
        </div>
        <LogoutButton className="rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-50">
          <LogOut className="size-4" />
        </LogoutButton>
      </div>
    </div>
  );
}

export function AdminSidebar({ items, name, role, sandbox }: { items: AdminNavItem[]; name: string; role: string; sandbox: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-foreground lg:flex">
        <div className="flex h-16 items-center px-5">
          <Logo light />
        </div>
        {sandbox && <p className="mx-4 mb-1 rounded-md bg-warning/20 px-2 py-1 text-center text-[11px] font-semibold tracking-wide text-[#fcd34d] uppercase">Dev sandbox</p>}
        <div className="flex-1 overflow-y-auto">
          <NavList items={items} />
        </div>
        <Footer name={name} role={role} />
      </aside>
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface px-4 lg:hidden">
        <Logo />
        <D.Root open={open} onOpenChange={setOpen}>
          <D.Trigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open admin menu"><Menu className="size-5" /></Button>
          </D.Trigger>
          <SheetContent title="Admin menu" side="left" className="bg-foreground">
            <div className="flex h-14 items-center px-5"><Logo light /></div>
            <div className="min-h-0 flex-1 overflow-y-auto"><NavList items={items} onNavigate={() => setOpen(false)} /></div>
            <Footer name={name} role={role} />
          </SheetContent>
        </D.Root>
      </div>
    </>
  );
}

"use client";

import { Bell, CalendarDays, CreditCard, LayoutDashboard, Package, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/account", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/account/orders", label: "My orders", icon: Package },
  { href: "/account/installments", label: "Repayment schedule", icon: CalendarDays },
  { href: "/account/payments", label: "Payment history", icon: CreditCard },
  { href: "/account/notifications", label: "Notifications", icon: Bell },
  { href: "/account/profile", label: "Profile & settings", icon: User },
];

export function AccountNav({ unread }: { unread: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Account" className="no-print -mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:px-0 lg:pb-0">
      {ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm transition",
              active ? "bg-surface font-medium text-foreground shadow-sm ring-1 ring-border" : "text-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
            {href === "/account/notifications" && unread > 0 && <span className="ml-auto rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white">{unread}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

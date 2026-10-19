"use client";

import { Bell, CreditCard, LayoutDashboard, LogOut, Menu, Package, Shield, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog as D } from "radix-ui";
import { useState } from "react";
import { logoutAction } from "@/app/actions/auth";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, SheetContent } from "@/components/ui/overlays";
import { cn, initials } from "@/lib/utils";

type NavItem = { href: string; label: string };
type HeaderUser = { name: string; email: string; isStaff: boolean; unread: number } | null;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={cn(
            "rounded-lg px-3 py-2 text-[14px] text-muted transition hover:text-foreground",
            isActive(pathname, i.href) && "font-medium text-foreground",
          )}
          aria-current={isActive(pathname, i.href) ? "page" : undefined}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

export function AccountMenu({ user }: { user: NonNullable<HeaderUser> }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="hidden items-center gap-2 rounded-full border border-border bg-surface py-1 pr-3 pl-1 text-sm transition hover:border-border-strong md:flex" aria-label="Account menu">
          <span className="relative grid size-7 place-items-center rounded-full bg-foreground text-[11px] font-semibold text-white">
            {initials(user.name)}
            {user.unread > 0 && <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface bg-accent" />}
          </span>
          <span className="max-w-28 truncate font-medium">{user.name.split(" ")[0]}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          <span className="block font-medium text-foreground">{user.name}</span>
          <span className="block truncate">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {user.isStaff ? (
          <DropdownMenuItem asChild>
            <Link href="/admin"><Shield /> Admin dashboard</Link>
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem asChild><Link href="/account"><LayoutDashboard /> Dashboard</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/account/orders"><Package /> My orders</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/account/payments"><CreditCard /> Payment history</Link></DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/account/notifications"><Bell /> Notifications {user.unread > 0 && <span className="ml-auto rounded-full bg-accent px-1.5 text-[11px] text-white">{user.unread}</span>}</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/account/profile"><User /> Profile</Link></DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <form action={logoutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full"><LogOut /> Log out</button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MobileNav({ items, user }: { items: NavItem[]; user: HeaderUser }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const close = () => setOpen(false);
  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <D.Trigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
      </D.Trigger>
      <SheetContent title="Menu">
        <div className="border-b border-border p-4">
          <Logo />
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3" aria-label="Mobile">
          {items.map((i) => (
            <Link key={i.href} href={i.href} onClick={close} className={cn("rounded-lg px-3 py-3 text-[15px]", isActive(pathname, i.href) ? "bg-surface-2 font-medium" : "text-muted")}>
              {i.label}
            </Link>
          ))}
          {user && (
            <>
              <div className="mt-3 border-t border-border pt-3 text-xs font-medium tracking-wide text-subtle uppercase">Your account</div>
              {user.isStaff ? (
                <Link href="/admin" onClick={close} className="rounded-lg px-3 py-3 text-[15px]">Admin dashboard</Link>
              ) : (
                <>
                  <Link href="/account" onClick={close} className="rounded-lg px-3 py-3 text-[15px]">Dashboard</Link>
                  <Link href="/account/orders" onClick={close} className="rounded-lg px-3 py-3 text-[15px]">My orders</Link>
                  <Link href="/account/payments" onClick={close} className="rounded-lg px-3 py-3 text-[15px]">Payment history</Link>
                  <Link href="/account/notifications" onClick={close} className="rounded-lg px-3 py-3 text-[15px]">Notifications {user.unread > 0 && `(${user.unread})`}</Link>
                  <Link href="/account/profile" onClick={close} className="rounded-lg px-3 py-3 text-[15px]">Profile</Link>
                </>
              )}
            </>
          )}
        </nav>
        <div className="border-t border-border p-4">
          {user ? (
            <form action={logoutAction}>
              <Button variant="outline" className="w-full" type="submit"><LogOut /> Log out</Button>
            </form>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" asChild><Link href="/login" onClick={close}>Log in</Link></Button>
              <Button asChild><Link href="/register" onClick={close}>Create account</Link></Button>
            </div>
          )}
        </div>
      </SheetContent>
    </D.Root>
  );
}

import Link from "next/link";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { isStaffRole } from "@/lib/permissions";
import { getActor } from "@/server/auth/session";
import { isSandboxMode } from "@/server/payments";
import { unreadCount } from "@/server/services/notifications";
import { AccountMenu, MobileNav, NavLinks } from "./site-header-client";

export const NAV = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop iPhones" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/promotions", label: "Promotions" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export async function SiteHeader() {
  const actor = await getActor().catch(() => null);
  const unread = actor && !isStaffRole(actor.role) ? await unreadCount(actor.userId).catch(() => 0) : 0;
  const user = actor ? { name: actor.name, email: actor.email, isStaff: isStaffRole(actor.role), unread } : null;
  return (
    <>
      {isSandboxMode() && (
        <div className="no-print bg-warning-soft py-1.5 text-center text-[12px] font-medium text-warning">
          Development sandbox — payments are simulated and no real money moves.
        </div>
      )}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl no-print">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
          <Logo />
          <NavLinks items={NAV} />
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <AccountMenu user={user} />
            ) : (
              <div className="hidden items-center gap-2 md:flex">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/login">Log in</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/register">Create account</Link>
                </Button>
              </div>
            )}
            <MobileNav items={NAV} user={user} />
          </div>
        </div>
      </header>
    </>
  );
}

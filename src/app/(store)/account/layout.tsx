import { AccountNav } from "@/components/account/account-nav";
import { requireCustomerPage } from "@/server/auth/session";
import { unreadCount } from "@/server/services/notifications";

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireCustomerPage("/account");
  const unread = await unreadCount(actor.userId);
  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:gap-10">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <AccountNav unread={unread} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

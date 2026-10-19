import { Bell } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/dates";
import { safeInternalPath } from "@/lib/validation";
import { Notification } from "@/models";
import { getActor, requireCustomerPage } from "@/server/auth/session";

export const metadata: Metadata = { title: "Notifications" };

async function markAllRead() {
  "use server";
  const actor = await getActor();
  if (!actor) return;
  await Notification.updateMany({ userId: actor.userId, channel: "in_app", readAt: null }, { $set: { readAt: new Date() } });
  revalidatePath("/account", "layout");
}

export default async function NotificationsPage() {
  const actor = await requireCustomerPage("/account/notifications");
  const items = await Notification.find({ userId: actor.userId, channel: "in_app" }).sort({ createdAt: -1 }).limit(100).lean();
  const unread = items.some((n) => !n.readAt);
  return (
    <div>
      <PageHeader
        title="Notifications"
        actions={unread ? <form action={markAllRead}><Button variant="outline" size="sm" type="submit">Mark all as read</Button></form> : undefined}
      />
      {items.length === 0 ? (
        <EmptyState icon={<Bell />} title="No notifications yet" description="Payment confirmations, reminders and plan updates will appear here." />
      ) : (
        <ul className="divide-y divide-border rounded-[16px] border border-border bg-surface">
          {items.map((n) => (
            <li key={n._id.toString()} className={`flex gap-3 p-4 ${n.readAt ? "" : "bg-accent-soft/40"}`}>
              <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-accent"}`} aria-label={n.readAt ? undefined : "Unread"} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{n.subject}</p>
                <p className="mt-0.5 text-[13.5px] text-muted">{n.content}</p>
                <p className="mt-1 text-[12px] text-subtle">{formatDateTime(n.createdAt)}</p>
              </div>
              {n.link && (
                <Link href={safeInternalPath(n.link, "/account")} className="self-center text-[13px] font-medium text-accent hover:underline">View</Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

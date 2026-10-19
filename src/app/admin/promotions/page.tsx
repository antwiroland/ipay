import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import Link from "next/link";
import { moderateReviewAction, promotionStatusAction, reorderPromotionsAction } from "@/app/actions/admin";
import { ActionButton } from "@/components/admin/action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/dates";
import { Promotion, Review } from "@/models";
import { requireStaffPage } from "@/server/auth/session";

export const metadata = { title: "Promotions & banners" };

function liveState(p: { status: string; startDate: Date; endDate: Date }, now: Date) {
  if (p.status !== "published") return { label: p.status, tone: "grey" as const };
  if (p.startDate > now) return { label: "Scheduled", tone: "info" as const };
  if (p.endDate < now) return { label: "Ended", tone: "grey" as const };
  return { label: "Live", tone: "success" as const };
}

export default async function PromotionsAdmin() {
  await requireStaffPage("promotions.manage", "/admin/promotions");
  const [promos, reviews] = await Promise.all([Promotion.find({ status: { $ne: "archived" } }).sort({ displayOrder: 1, startDate: -1 }).lean(), Review.find({ status: "pending" }).sort({ createdAt: -1 }).limit(20).lean()]);
  const now = new Date();
  const ids = promos.map((p) => p._id.toString());
  const swap = (i: number, j: number) => {
    const next = [...ids];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  };
  return (
    <div className="space-y-6">
      <PageHeader title="Promotions & banners" description="Homepage campaigns update instantly — no redeploy needed." actions={<Button asChild><Link href="/admin/promotions/new"><Plus /> New campaign</Link></Button>} />
      <div className="space-y-3">
        {promos.length === 0 && <p className="text-sm text-muted">No campaigns yet.</p>}
        {promos.map((p, i) => {
          const st = liveState(p, now);
          const ctr = p.impressions ? ((p.clicks / p.impressions) * 100).toFixed(1) : "0.0";
          return (
            <Card key={p._id.toString()} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.desktopImage} alt="" className="aspect-[16/7] w-full rounded-[10px] object-cover sm:w-48" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><Badge tone={st.tone} dot>{st.label}</Badge>{p.discountBps > 0 && <Badge tone="accent">{p.discountBps / 100}% off</Badge>}</div>
                <Link href={`/admin/promotions/${p._id}`} className="mt-1 block font-semibold hover:underline">{p.title}</Link>
                <p className="text-[12.5px] text-muted">{formatDateTime(p.startDate)} → {formatDateTime(p.endDate)}</p>
                <p className="tabular mt-1 text-[12.5px] text-muted">{p.impressions.toLocaleString()} impressions · {p.clicks.toLocaleString()} clicks · CTR {ctr}%</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {i > 0 && <ActionButton variant="ghost" label="↑" action={reorderPromotionsAction.bind(null, swap(i, i - 1))} />}
                {i < promos.length - 1 && <ActionButton variant="ghost" label="↓" action={reorderPromotionsAction.bind(null, swap(i, i + 1))} />}
                {p.status === "published" ? (
                  <ActionButton label="Unpublish" action={promotionStatusAction.bind(null, p._id.toString(), "draft")} />
                ) : (
                  <ActionButton variant="primary" label="Publish" action={promotionStatusAction.bind(null, p._id.toString(), "published")} />
                )}
                <ActionButton danger label="Archive" action={promotionStatusAction.bind(null, p._id.toString(), "archived")} confirm={{ title: "Archive this campaign?" }} />
              </div>
            </Card>
          );
        })}
      </div>
      <p className="flex items-center gap-1 text-[12px] text-muted"><ArrowUp className="size-3" /><ArrowDown className="size-3" /> Use the arrows to change the order banners appear in.</p>

      <Card>
        <CardHeader><CardTitle>Customer reviews awaiting moderation</CardTitle></CardHeader>
        <CardContent>
          {reviews.length === 0 ? <p className="text-sm text-muted">No pending reviews. Only approved, genuine reviews from customers with completed orders appear on the homepage.</p> : (
            <ul className="space-y-3">
              {reviews.map((r) => (
                <li key={r._id.toString()} className="flex flex-col justify-between gap-2 rounded-[12px] border border-border p-3 sm:flex-row sm:items-center">
                  <div className="text-sm"><p className="font-medium">{r.displayName} · {"★".repeat(r.rating)}</p><p className="text-muted">{r.body}</p></div>
                  <div className="flex gap-2">
                    <ActionButton variant="primary" label="Approve" action={moderateReviewAction.bind(null, r._id.toString(), "approved")} />
                    <ActionButton label="Reject" action={moderateReviewAction.bind(null, r._id.toString(), "rejected")} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

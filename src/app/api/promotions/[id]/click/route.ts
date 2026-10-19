import { NextResponse } from "next/server";
import { isSafeDestination } from "@/lib/validation";
import { promotionHref, trackPromotion } from "@/server/services/promotions";

export const dynamic = "force-dynamic";

/** Counts a banner click, then redirects to the campaign's validated destination. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const promo = await trackPromotion(id, "click").catch(() => null);
  const base = new URL(req.url);
  if (!promo) return NextResponse.redirect(new URL("/promotions", base));
  const href = promotionHref(promo);
  const dest = isSafeDestination(href) ? new URL(href, base) : new URL("/promotions", base);
  return NextResponse.redirect(dest);
}

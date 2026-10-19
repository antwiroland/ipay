import { NextResponse } from "next/server";
import { hasPermission } from "@/lib/permissions";
import { getActor } from "@/server/auth/session";
import { AppError, httpStatusFor } from "@/server/errors";
import { rateLimit } from "@/server/rate-limit";
import { audit } from "@/server/services/audit";
import { MAX_UPLOAD_BYTES, storeImage } from "@/server/storage";

export const runtime = "nodejs";

function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  return !!origin && !!host && new URL(origin).host === host;
}

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) throw new AppError("FORBIDDEN", "Cross-origin upload refused.");
    const actor = await getActor();
    if (!actor) throw new AppError("UNAUTHENTICATED", "Sign in again.");
    const folder = new URL(req.url).searchParams.get("folder") === "banners" ? "banners" : "products";
    const perm = folder === "banners" ? "promotions.manage" : "products.manage";
    if (!hasPermission(actor.role, perm)) throw new AppError("FORBIDDEN", "Not allowed.");
    await rateLimit("upload", actor.userId, 60, 3600);
    const len = Number(req.headers.get("content-length") ?? 0);
    if (len > MAX_UPLOAD_BYTES + 64 * 1024) throw new AppError("VALIDATION", "Images must be 5 MB or smaller.");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError("VALIDATION", "No file received.");
    const stored = await storeImage(Buffer.from(await file.arrayBuffer()), folder);
    await audit(actor, "media.upload", "Media", stored.publicId, { metadata: { folder, size: file.size } });
    return NextResponse.json(stored);
  } catch (err) {
    const e = err instanceof AppError ? err : new AppError("VALIDATION", "Upload failed.");
    if (!(err instanceof AppError)) console.error("[upload]", err);
    return NextResponse.json({ error: e.message }, { status: httpStatusFor(e.code) });
  }
}

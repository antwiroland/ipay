import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { audit } from "@/server/services/audit";
import { runDailyJobs } from "@/server/services/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Vercel Cron (see vercel.json). Sends reminders, refreshes statuses, expires stale payments. */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await runDailyJobs();
  await audit(null, "system.daily_jobs", "System", null, { metadata: result });
  return NextResponse.json(result);
}

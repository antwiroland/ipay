import { NextResponse } from "next/server";
import { connectDB } from "@/server/db";
import { mockPaymentsAllowed } from "@/server/payments";
import { mockProvider } from "@/server/payments/mock";
import { confirmPayment } from "@/server/services/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Development-only webhook endpoint (HMAC-SHA256 with MOCK_WEBHOOK_SECRET in `x-mock-signature`). */
export async function POST(req: Request) {
  if (!mockPaymentsAllowed()) return NextResponse.json({ error: "not found" }, { status: 404 });
  const raw = await req.text();
  if (!mockProvider.verifyWebhookSignature(raw, req.headers.get("x-mock-signature"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  const event = mockProvider.parseWebhook(raw);
  if (!event.reference) return NextResponse.json({ error: "missing reference" }, { status: 400 });
  await connectDB();
  const outcome = await confirmPayment(event.reference);
  return NextResponse.json({ received: true, outcome });
}

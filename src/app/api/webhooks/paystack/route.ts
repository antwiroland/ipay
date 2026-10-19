import { NextResponse } from "next/server";
import { paystackProvider } from "@/server/payments/paystack";
import { audit } from "@/server/services/audit";
import { confirmPayment } from "@/server/services/payments";
import { connectDB } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Paystack webhook. Signature = HMAC-SHA512(secret key, raw body) in `x-paystack-signature`.
 * We never trust the webhook body for amounts/status: confirmPayment() re-verifies with Paystack's API
 * and is idempotent, so retries and duplicates are safe.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!paystackProvider.verifyWebhookSignature(raw, req.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  let event;
  try {
    event = paystackProvider.parseWebhook(raw);
  } catch {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }
  await connectDB();
  if (event.reference && (event.event === "charge.success" || event.event === "charge.failed")) {
    try {
      const outcome = await confirmPayment(event.reference);
      return NextResponse.json({ received: true, outcome: outcome.status });
    } catch (err) {
      console.error("[webhook:paystack]", err);
      // 5xx makes Paystack retry later; processing is idempotent.
      return NextResponse.json({ error: "processing failed" }, { status: 500 });
    }
  }
  if (event.event.startsWith("refund.") || event.event.startsWith("charge.dispute")) {
    await audit(null, `provider.${event.event}`, "Payment", event.reference, { metadata: { note: "Review in admin › Payments" } });
  }
  return NextResponse.json({ received: true });
}

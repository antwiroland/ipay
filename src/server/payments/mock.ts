/**
 * DEVELOPMENT-ONLY payment provider. Simulates a hosted checkout + webhooks so the full
 * payment lifecycle can be exercised without merchant credentials.
 * Payments created with it are stored with isTest=true and labelled "DEV SANDBOX" everywhere.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { MockCharge } from "@/models";
import type { PaymentProvider } from "./types";

export function mockWebhookSecret() {
  return process.env.MOCK_WEBHOOK_SECRET || "dev-mock-webhook-secret";
}

export function signMock(rawBody: string) {
  return createHmac("sha256", mockWebhookSecret()).update(rawBody).digest("hex");
}

export const mockProvider: PaymentProvider = {
  name: "mock",
  isTest: true,

  async initialize(input) {
    await MockCharge.updateOne(
      { _id: input.reference },
      { $setOnInsert: { _id: input.reference, amount: input.amount, currency: input.currency, status: "pending" } },
      { upsert: true },
    );
    const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
    return { checkoutUrl: `${base}/dev/checkout/${encodeURIComponent(input.reference)}`, providerReference: `mock_${input.reference}` };
  },

  async verify(reference) {
    const c = await MockCharge.findById(reference).lean();
    if (!c) return { status: "failed", amount: 0, currency: "GHS", reference, gatewayResponse: "Unknown reference" };
    return {
      status: c.status === "success" ? "success" : c.status === "pending" ? "pending" : c.status === "abandoned" ? "abandoned" : "failed",
      amount: c.amount,
      currency: c.currency,
      reference,
      providerReference: `mock_${reference}`,
      method: c.channel,
      channelDetail: c.channel === "card" ? "Test Visa •••• 4081" : "Test MoMo •••123",
      paidAt: c.status === "success" ? (c.updatedAt ?? new Date()) : null,
      gatewayResponse: c.status === "success" ? "Approved (sandbox)" : "Declined (sandbox)",
    };
  },

  verifyWebhookSignature(rawBody, signature) {
    if (!signature) return false;
    const a = Buffer.from(signMock(rawBody), "hex");
    const b = Buffer.from(signature, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  },

  parseWebhook(rawBody) {
    const b = JSON.parse(rawBody) as { event?: string; reference?: string };
    return { event: b.event ?? "charge.success", reference: b.reference ?? null };
  },

  async refund(reference, amount) {
    await MockCharge.updateOne({ _id: reference }, { $inc: { refunded: amount } });
    return { ok: true, providerReference: `mock_refund_${Date.now()}` };
  },
};

/** Used by the dev checkout page and tests to simulate the customer completing checkout. */
export async function setMockOutcome(reference: string, outcome: "success" | "failed" | "abandoned", channel: "mobile_money" | "card" = "mobile_money") {
  await MockCharge.updateOne({ _id: reference, status: "pending" }, { $set: { status: outcome, channel } });
}

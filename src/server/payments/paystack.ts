import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentProvider, VerifiedStatus } from "./types";

const BASE = "https://api.paystack.co";

function secret() {
  // Trimmed: keys pasted into hosting dashboards often pick up stray whitespace.
  const key = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured");
  return key;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${secret()}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: unknown };
  if (!res.ok || json.status === false) {
    throw new Error(`Paystack ${path} failed: ${json.message ?? res.status}`);
  }
  return json.data as T;
}

function mapStatus(s: string): VerifiedStatus {
  if (s === "success") return "success";
  if (s === "failed" || s === "reversed") return "failed";
  if (s === "abandoned") return "abandoned";
  return "pending"; // ongoing, pending, processing, queued
}

export const paystackProvider: PaymentProvider = {
  name: "paystack",
  get isTest() {
    return (process.env.PAYSTACK_SECRET_KEY ?? "").trim().startsWith("sk_test_");
  },

  async initialize(input) {
    const data = await call<{ authorization_url: string; access_code: string; reference: string }>("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email: input.email,
        amount: input.amount, // Paystack expects the lowest currency unit (pesewas)
        currency: input.currency,
        reference: input.reference,
        callback_url: input.callbackUrl,
        channels: ["mobile_money", "card"],
        metadata: input.metadata,
      }),
    });
    return { checkoutUrl: data.authorization_url, providerReference: data.access_code };
  },

  async verify(reference) {
    const d = await call<{
      id: number;
      status: string;
      amount: number;
      currency: string;
      reference: string;
      channel: string;
      paid_at: string | null;
      gateway_response: string;
      authorization?: { last4?: string; bank?: string; brand?: string; mobile_money_number?: string };
    }>(`/transaction/verify/${encodeURIComponent(reference)}`);
    const a = d.authorization ?? {};
    const detail =
      d.channel === "card"
        ? `${a.brand ?? "Card"} •••• ${a.last4 ?? ""}`.trim()
        : d.channel === "mobile_money"
          ? `${a.bank ?? "Mobile Money"} •••${(a.mobile_money_number ?? a.last4 ?? "").slice(-3)}`
          : d.channel;
    return {
      status: mapStatus(d.status),
      amount: d.amount,
      currency: d.currency,
      reference: d.reference,
      providerReference: String(d.id),
      method: d.channel,
      channelDetail: detail,
      paidAt: d.paid_at ? new Date(d.paid_at) : null,
      gatewayResponse: d.gateway_response,
    };
  },

  verifyWebhookSignature(rawBody, signature) {
    if (!signature) return false;
    const expected = createHmac("sha512", secret()).update(rawBody).digest("hex");
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signature, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  },

  parseWebhook(rawBody) {
    const body = JSON.parse(rawBody) as { event?: string; data?: { reference?: string; transaction_reference?: string } };
    return { event: body.event ?? "unknown", reference: body.data?.reference ?? body.data?.transaction_reference ?? null };
  },

  async refund(reference, amount) {
    try {
      const d = await call<{ id: number }>("/refund", { method: "POST", body: JSON.stringify({ transaction: reference, amount }) });
      return { ok: true, providerReference: String(d.id) };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
};

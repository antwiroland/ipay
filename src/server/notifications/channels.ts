/** Delivery adapters. Each returns provider name + success; never throws to callers. */

export interface DeliveryResult {
  ok: boolean;
  provider: string;
  error?: string;
  skipped?: boolean;
}

export async function sendEmail(to: string, subject: string, text: string): Promise<DeliveryResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") return { ok: false, provider: "none", skipped: true, error: "Email not configured" };
    if (process.env.NODE_ENV !== "test") console.info(`[email:dev] to=${to} subject="${subject}"\n${text}`);
    return { ok: true, provider: "console" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "iPay Ghana <no-reply@ipayghana.com>",
        to: [to],
        subject,
        text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, provider: "resend", error: `HTTP ${res.status}` };
    return { ok: true, provider: "resend" };
  } catch (e) {
    return { ok: false, provider: "resend", error: (e as Error).message };
  }
}

/** Hubtel SMS (Ghana). Configure HUBTEL_SMS_CLIENT_ID / SECRET / SENDER. */
export async function sendSms(to: string, text: string): Promise<DeliveryResult> {
  const id = process.env.HUBTEL_SMS_CLIENT_ID;
  const secret = process.env.HUBTEL_SMS_CLIENT_SECRET;
  if (!id || !secret) {
    if (process.env.NODE_ENV === "production") return { ok: false, provider: "none", skipped: true, error: "SMS not configured" };
    if (process.env.NODE_ENV !== "test") console.info(`[sms:dev] to=${to} ${text}`);
    return { ok: true, provider: "console" };
  }
  try {
    const url = new URL("https://smsc.hubtel.com/v1/messages/send");
    url.searchParams.set("clientid", id);
    url.searchParams.set("clientsecret", secret);
    url.searchParams.set("from", process.env.HUBTEL_SMS_SENDER || "iPayGhana");
    url.searchParams.set("to", to.replace(/^\+/, ""));
    url.searchParams.set("content", text);
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return { ok: false, provider: "hubtel", error: `HTTP ${res.status}` };
    return { ok: true, provider: "hubtel" };
  } catch (e) {
    return { ok: false, provider: "hubtel", error: (e as Error).message };
  }
}

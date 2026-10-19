"use server";

import { z } from "zod";
import { emailSchema } from "@/lib/validation";
import { ContactMessage, Subscriber } from "@/models";
import { run } from "@/server/action";
import { requestMeta } from "@/server/auth/session";
import { connectDB } from "@/server/db";
import { AppError, type ActionResult } from "@/server/errors";
import { rateLimit } from "@/server/rate-limit";
import { trackPromotion } from "@/server/services/promotions";

export async function subscribeAction(_prev: unknown, form: FormData): Promise<ActionResult<null>> {
  return run(async () => {
    const meta = await requestMeta();
    await rateLimit("subscribe", meta.ip ?? "unknown", 10, 3600);
    if (form.get("consent") !== "on") throw new AppError("VALIDATION", "Please tick the consent box.");
    const email = emailSchema.safeParse(form.get("email"));
    if (!email.success) throw new AppError("VALIDATION", "Enter a valid email address.");
    await connectDB();
    await Subscriber.updateOne(
      { email: email.data },
      { $set: { consentAt: new Date(), unsubscribedAt: null }, $setOnInsert: { email: email.data, source: "footer" } },
      { upsert: true },
    );
    return null;
  });
}

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  phone: z.string().trim().max(20).optional(),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10, "Tell us a bit more (10+ characters)").max(4000),
});

export async function contactAction(input: unknown) {
  return run(async () => {
    const meta = await requestMeta();
    await rateLimit("contact", meta.ip ?? "unknown", 5, 3600);
    const r = contactSchema.safeParse(input);
    if (!r.success) throw new AppError("VALIDATION", "Please check the form.", { fieldErrors: z.flattenError(r.error).fieldErrors });
    await connectDB();
    await ContactMessage.create(r.data);
    return null;
  }, "Thanks! Our team will get back to you within one business day.");
}

export async function trackImpressionAction(promotionId: string) {
  await trackPromotion(String(promotionId), "impression").catch(() => null);
}

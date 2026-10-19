import { Types } from "mongoose";
import { Notification, NotificationTemplate, User } from "@/models";
import type { NotificationTemplateKey } from "@/models/Notification";
import { isDuplicateKeyError } from "../db";
import { sendEmail, sendSms } from "../notifications/channels";
import { DEFAULT_TEMPLATES, renderTemplate } from "../notifications/templates";

type Vars = Record<string, string | number | null | undefined>;

export interface NotifyOptions {
  /** Unique key for this logical event. Repeated calls with the same key (e.g. duplicate webhooks) are no-ops. */
  dedupeKey?: string;
  link?: string;
  channels?: ("in_app" | "email" | "sms")[];
}

async function loadTemplate(key: NotificationTemplateKey) {
  const def = DEFAULT_TEMPLATES[key];
  const override = await NotificationTemplate.findOne({ key }).lean();
  if (override && !override.enabled) return null;
  return {
    ...def,
    subject: override?.subject ?? def.subject,
    body: override?.body ?? def.body,
    smsBody: override?.smsBody ?? def.smsBody,
  };
}

/**
 * Record and deliver a notification. Never throws — notification failure must not roll back business operations.
 * Call AFTER the business transaction commits.
 */
export async function notify(userId: string | Types.ObjectId, key: NotificationTemplateKey, vars: Vars, opts: NotifyOptions = {}) {
  try {
    const user = await User.findById(userId).lean();
    if (!user) return;
    const tpl = await loadTemplate(key);
    if (!tpl) return;
    const allVars = { name: user.name.split(" ")[0], ...vars };
    const subject = renderTemplate(tpl.subject, allVars);
    const body = renderTemplate(tpl.body, allVars);
    const sms = renderTemplate(tpl.smsBody, allVars);

    if (tpl.marketing && !user.notificationPreferences?.marketing) return;

    const channels = opts.channels ?? ["in_app", "email", "sms"];
    for (const channel of channels) {
      if (channel === "email" && !tpl.transactional && !user.notificationPreferences?.email) continue;
      if (channel === "sms" && !user.notificationPreferences?.sms) continue;
      if (channel === "in_app" && key === "password_reset") continue;

      let doc;
      try {
        doc = await Notification.create({
          userId: user._id,
          channel,
          template: key,
          subject,
          // Never persist secrets (reset links) in the notification log.
          content:
            channel === "sms" ? sms : key === "password_reset" ? renderTemplate(tpl.body, { ...allVars, link: "[link redacted]" }) : body,
          link: opts.link ?? null,
          dedupeKey: opts.dedupeKey ? `${opts.dedupeKey}:${channel}` : null,
          deliveryStatus: channel === "in_app" ? "sent" : "queued",
          sentAt: channel === "in_app" ? new Date() : null,
          provider: channel === "in_app" ? "in_app" : null,
        });
      } catch (err) {
        if (isDuplicateKeyError(err)) continue; // already sent for this event
        throw err;
      }
      if (channel === "in_app") continue;

      const result = channel === "email" ? await sendEmail(user.email, subject, body) : await sendSms(user.phone, sms);
      await Notification.updateOne(
        { _id: doc._id },
        {
          $set: {
            deliveryStatus: result.ok ? "sent" : result.skipped ? "skipped" : "failed",
            provider: result.provider,
            error: result.error ?? null,
            sentAt: result.ok ? new Date() : null,
          },
        },
      );
    }
  } catch (err) {
    console.error("[notify] failed", key, err);
  }
}

/** Send a password-reset email directly (link must never be stored in in-app notifications). */
export async function notifyPasswordReset(userId: string, link: string) {
  return notify(userId, "password_reset", { link }, { channels: ["email"] });
}

export async function unreadCount(userId: string) {
  return Notification.countDocuments({ userId, channel: "in_app", readAt: null });
}

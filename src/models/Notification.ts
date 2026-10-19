import { Schema, type Types } from "mongoose";
import { getModel } from "./_helpers";

export const NOTIFICATION_TEMPLATES = [
  "registration",
  "verification_result",
  "application_approved",
  "application_rejected",
  "deposit_confirmed",
  "device_ready",
  "device_collected",
  "payment_reminder",
  "payment_confirmed",
  "payment_failed",
  "installment_overdue",
  "refund_processed",
  "plan_completed",
  "password_reset",
  "promotion",
] as const;
export type NotificationTemplateKey = (typeof NOTIFICATION_TEMPLATES)[number];

export interface INotification {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  channel: "in_app" | "email" | "sms";
  template: NotificationTemplateKey;
  subject: string;
  content: string;
  link?: string | null;
  dedupeKey?: string | null; // `${template}:${resource}:${channel}` — repeated triggers become no-ops
  deliveryStatus: "queued" | "sent" | "failed" | "skipped";
  provider?: string | null;
  error?: string | null;
  readAt?: Date | null;
  sentAt?: Date | null;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    channel: { type: String, enum: ["in_app", "email", "sms"], required: true },
    template: { type: String, enum: NOTIFICATION_TEMPLATES, required: true },
    subject: { type: String, required: true },
    content: { type: String, required: true },
    link: { type: String, default: null },
    dedupeKey: { type: String, default: null },
    deliveryStatus: { type: String, enum: ["queued", "sent", "failed", "skipped"], default: "queued" },
    provider: { type: String, default: null },
    error: { type: String, default: null },
    readAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
NotificationSchema.index({ userId: 1, channel: 1, createdAt: -1 });
NotificationSchema.index({ dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } });
NotificationSchema.index({ deliveryStatus: 1, createdAt: -1 });

export const Notification = getModel<INotification>("Notification", NotificationSchema);

export interface INotificationTemplate {
  _id: Types.ObjectId;
  key: NotificationTemplateKey;
  subject: string;
  body: string; // supports {{placeholders}}
  smsBody: string;
  enabled: boolean;
  updatedBy?: Types.ObjectId | null;
  updatedAt: Date;
}
const NotificationTemplateSchema = new Schema<INotificationTemplate>(
  {
    key: { type: String, enum: NOTIFICATION_TEMPLATES, required: true, unique: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    smsBody: { type: String, required: true, maxlength: 480 },
    enabled: { type: Boolean, default: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);
export const NotificationTemplate = getModel<INotificationTemplate>("NotificationTemplate", NotificationTemplateSchema);

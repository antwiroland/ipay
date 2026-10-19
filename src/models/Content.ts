import { Schema, type Types } from "mongoose";
import { getModel } from "./_helpers";

export interface IPromotion {
  _id: Types.ObjectId;
  title: string;
  subtitle: string;
  badge?: string | null;
  desktopImage: string;
  mobileImage: string;
  callToAction: string;
  destinationType: "url" | "product";
  destination: string; // internal path when url; product slug resolved when product
  linkedProductIds: Types.ObjectId[];
  discountBps: number; // optional campaign discount on linked products' installment price
  eligiblePlanIds: Types.ObjectId[];
  startDate: Date;
  endDate: Date;
  status: "draft" | "published" | "archived";
  displayOrder: number;
  showCountdown: boolean;
  impressions: number;
  clicks: number;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const PromotionSchema = new Schema<IPromotion>(
  {
    title: { type: String, required: true, maxlength: 120 },
    subtitle: { type: String, default: "", maxlength: 300 },
    badge: { type: String, default: null, maxlength: 40 },
    desktopImage: { type: String, required: true },
    mobileImage: { type: String, required: true },
    callToAction: { type: String, default: "Shop now", maxlength: 40 },
    destinationType: { type: String, enum: ["url", "product"], default: "url" },
    destination: { type: String, required: true },
    linkedProductIds: [{ type: Schema.Types.ObjectId, ref: "Product" }],
    discountBps: { type: Number, default: 0, min: 0, max: 5000 },
    eligiblePlanIds: [{ type: Schema.Types.ObjectId, ref: "PaymentPlan" }],
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ["draft", "published", "archived"], default: "draft" },
    displayOrder: { type: Number, default: 0 },
    showCountdown: { type: Boolean, default: false },
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);
PromotionSchema.index({ status: 1, startDate: 1, endDate: 1, displayOrder: 1 });
PromotionSchema.pre("validate", function () {
  if (this.endDate <= this.startDate) this.invalidate("endDate", "Campaign must end after it starts");
});
export const Promotion = getModel<IPromotion>("Promotion", PromotionSchema);

export interface IReview {
  _id: Types.ObjectId;
  customerId: Types.ObjectId;
  orderId: Types.ObjectId;
  displayName: string;
  rating: number;
  body: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
}
const ReviewSchema = new Schema<IReview>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    displayName: { type: String, required: true, maxlength: 60 },
    rating: { type: Number, min: 1, max: 5, required: true },
    body: { type: String, required: true, maxlength: 600 },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
export const Review = getModel<IReview>("Review", ReviewSchema);

export interface ISubscriber {
  _id: Types.ObjectId;
  email: string;
  consentAt: Date;
  source: string;
  unsubscribedAt?: Date | null;
}
const SubscriberSchema = new Schema<ISubscriber>({
  email: { type: String, required: true, lowercase: true, trim: true, unique: true },
  consentAt: { type: Date, required: true },
  source: { type: String, default: "homepage" },
  unsubscribedAt: { type: Date, default: null },
});
export const Subscriber = getModel<ISubscriber>("Subscriber", SubscriberSchema);

export interface IContactMessage {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: "new" | "handled";
  createdAt: Date;
}
const ContactMessageSchema = new Schema<IContactMessage>(
  {
    name: { type: String, required: true, maxlength: 120 },
    email: { type: String, required: true, maxlength: 254 },
    phone: { type: String, maxlength: 20 },
    subject: { type: String, required: true, maxlength: 160 },
    message: { type: String, required: true, maxlength: 4000 },
    status: { type: String, enum: ["new", "handled"], default: "new", index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
export const ContactMessage = getModel<IContactMessage>("ContactMessage", ContactMessageSchema);

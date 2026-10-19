import { Schema, type Types } from "mongoose";
import { getModel, money } from "./_helpers";

export interface IProduct {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  model: string; // e.g. "iPhone 15 Pro"
  series: number; // e.g. 15 — for filtering/sorting
  storage: string; // "128GB"
  storageGb: number;
  colourOptions: { name: string; hex: string }[];
  condition: "brand_new" | "uk_used";
  images: { url: string; alt: string; publicId?: string | null }[];
  specs: { label: string; value: string }[];
  cashPrice: number;
  installmentPrice: number;
  costPrice: number; // admin-only, for COGS / inventory value
  promoCashPrice?: number | null;
  promoInstallmentPrice?: number | null;
  promoStartsAt?: Date | null;
  promoEndsAt?: Date | null;
  addOns: { key: string; name: string; price: number }[];
  planIds: Types.ObjectId[]; // empty = all active plans
  stockQuantity: number;
  isFeatured: boolean;
  isPublished: boolean;
  isAvailable: boolean; // manual "unavailable" switch
  isArchived: boolean;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, lowercase: true, trim: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
    description: { type: String, default: "", maxlength: 5000 },
    model: { type: String, required: true, trim: true },
    series: { type: Number, required: true, min: 1 },
    storage: { type: String, required: true },
    storageGb: { type: Number, required: true, min: 1 },
    colourOptions: [{ _id: false, name: { type: String, required: true }, hex: { type: String, match: /^#[0-9a-fA-F]{6}$/ } }],
    condition: { type: String, enum: ["brand_new", "uk_used"], required: true },
    images: [{ _id: false, url: { type: String, required: true }, alt: { type: String, default: "" }, publicId: String }],
    specs: [{ _id: false, label: String, value: String }],
    cashPrice: money(),
    installmentPrice: money(),
    costPrice: money({ default: 0 }),
    promoCashPrice: { ...money({ required: false }), default: null },
    promoInstallmentPrice: { ...money({ required: false }), default: null },
    promoStartsAt: { type: Date, default: null },
    promoEndsAt: { type: Date, default: null },
    addOns: [{ _id: false, key: { type: String, required: true }, name: { type: String, required: true }, price: money() }],
    planIds: [{ type: Schema.Types.ObjectId, ref: "PaymentPlan" }],
    stockQuantity: { type: Number, required: true, min: 0, default: 0, validate: Number.isInteger },
    isFeatured: { type: Boolean, default: false },
    isPublished: { type: Boolean, default: false },
    isAvailable: { type: Boolean, default: true },
    isArchived: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

ProductSchema.index({ slug: 1 }, { unique: true });
ProductSchema.index({ isPublished: 1, isArchived: 1, isFeatured: -1, createdAt: -1 });
ProductSchema.index({ isPublished: 1, installmentPrice: 1 });
ProductSchema.index({ name: "text", model: "text" });

ProductSchema.pre("validate", function () {
  if (this.installmentPrice < this.cashPrice) {
    this.invalidate("installmentPrice", "Installment price cannot be lower than the cash price");
  }
  if (this.promoInstallmentPrice != null && this.promoInstallmentPrice > this.installmentPrice) {
    this.invalidate("promoInstallmentPrice", "Promotional price must be lower than the regular installment price");
  }
  if (this.promoStartsAt && this.promoEndsAt && this.promoEndsAt <= this.promoStartsAt) {
    this.invalidate("promoEndsAt", "Promotion must end after it starts");
  }
});

export const Product = getModel<IProduct>("Product", ProductSchema);

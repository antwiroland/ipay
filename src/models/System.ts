import { Schema, type Types } from "mongoose";
import { getModel, makeAppendOnly } from "./_helpers";

/* ---------- Audit log (append-only) ---------- */
export interface IAuditLog {
  _id: Types.ObjectId;
  actorId?: Types.ObjectId | null; // null = system
  actorRole?: string | null;
  action: string; // e.g. "order.approve"
  resourceType: string;
  resourceId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  timestamp: Date;
}
const AuditLogSchema = new Schema<IAuditLog>({
  actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  actorRole: { type: String, default: null },
  action: { type: String, required: true },
  resourceType: { type: String, required: true },
  resourceId: { type: String, default: null },
  reason: { type: String, default: null },
  metadata: { type: Schema.Types.Mixed, default: null },
  ip: { type: String, default: null },
  timestamp: { type: Date, default: () => new Date() },
});
AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ resourceType: 1, resourceId: 1, timestamp: -1 });
AuditLogSchema.index({ actorId: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
makeAppendOnly(AuditLogSchema, "AuditLog");
export const AuditLog = getModel<IAuditLog>("AuditLog", AuditLogSchema);

/* ---------- Inventory movements ---------- */
export interface IInventoryMovement {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  type: "restock" | "reserve" | "release" | "adjustment" | "dispatch";
  quantity: number; // signed change applied to stockQuantity (dispatch = 0: reserved unit leaves premises)
  orderId?: Types.ObjectId | null;
  actorId?: Types.ObjectId | null;
  note?: string | null;
  stockAfter?: number | null;
  createdAt: Date;
}
const InventoryMovementSchema = new Schema<IInventoryMovement>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    type: { type: String, enum: ["restock", "reserve", "release", "adjustment", "dispatch"], required: true },
    quantity: { type: Number, required: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", default: null },
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    note: { type: String, default: null },
    stockAfter: { type: Number, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
InventoryMovementSchema.index({ createdAt: -1 });
makeAppendOnly(InventoryMovementSchema, "InventoryMovement");
export const InventoryMovement = getModel<IInventoryMovement>("InventoryMovement", InventoryMovementSchema);

/* ---------- Identity verification (minimal data) ---------- */
export interface IIdentityVerification {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  documentType: "ghana_card" | "passport" | "drivers_licence" | "voter_id";
  idLast4: string;
  idHash: string; // HMAC-SHA256(ID_HASH_SECRET, normalized id) — detects duplicates without storing the number
  dateOfBirth?: Date | null;
  method: "in_person" | "provider";
  provider?: string | null;
  providerReference?: string | null;
  status: "pending" | "verified" | "rejected";
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  reviewNote?: string | null;
  createdAt: Date;
}
const IdentityVerificationSchema = new Schema<IIdentityVerification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    documentType: { type: String, enum: ["ghana_card", "passport", "drivers_licence", "voter_id"], required: true },
    idLast4: { type: String, required: true, maxlength: 4 },
    idHash: { type: String, required: true },
    dateOfBirth: { type: Date, default: null },
    method: { type: String, enum: ["in_person", "provider"], default: "in_person" },
    provider: { type: String, default: null },
    providerReference: { type: String, default: null },
    status: { type: String, enum: ["pending", "verified", "rejected"], default: "pending", index: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
IdentityVerificationSchema.index({ idHash: 1, status: 1 });
export const IdentityVerification = getModel<IIdentityVerification>("IdentityVerification", IdentityVerificationSchema);

/* ---------- Internal customer notes ---------- */
export interface ICustomerNote {
  _id: Types.ObjectId;
  customerId: Types.ObjectId;
  authorId: Types.ObjectId;
  body: string;
  createdAt: Date;
}
const CustomerNoteSchema = new Schema<ICustomerNote>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, maxlength: 2000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
export const CustomerNote = getModel<ICustomerNote>("CustomerNote", CustomerNoteSchema);

/* ---------- Counters (order numbers) ---------- */
export interface ICounter {
  _id: string;
  seq: number;
}
const CounterSchema = new Schema<ICounter>({ _id: String, seq: { type: Number, default: 0 } });
export const Counter = getModel<ICounter>("Counter", CounterSchema);

/* ---------- Business settings (singleton, _id = "global") ---------- */
export interface ISetting {
  _id: string;
  productsMenuLabel: "Products & Offers" | "Projects";
  purchaseModels: {
    take_and_pay: { enabled: boolean; summary: string };
    pay_small_small: { enabled: boolean; summary: string };
  };
  reminderDaysBefore: number;
  pendingPaymentTtlMinutes: number;
  requireStaffMfa: boolean;
  supportPhone: string;
  supportWhatsapp: string;
  supportEmail: string;
  storeAddress: string;
  socialLinks: { instagram?: string; tiktok?: string; x?: string; facebook?: string };
  updatedAt?: Date;
}
const SettingSchema = new Schema<ISetting>(
  {
    _id: { type: String },
    productsMenuLabel: { type: String, enum: ["Products & Offers", "Projects"], default: "Products & Offers" },
    purchaseModels: {
      take_and_pay: {
        enabled: { type: Boolean, default: true },
        summary: { type: String, default: "Pay a deposit, get verified and take your iPhone home. Pay the rest in installments." },
      },
      pay_small_small: {
        enabled: { type: Boolean, default: true },
        summary: { type: String, default: "Contribute at your pace while we keep your iPhone safe. Collect it once fully paid." },
      },
    },
    reminderDaysBefore: { type: Number, default: 2, min: 0, max: 14 },
    pendingPaymentTtlMinutes: { type: Number, default: 60, min: 10, max: 1440 },
    requireStaffMfa: { type: Boolean, default: false },
    supportPhone: { type: String, default: "+233 30 000 0000" },
    supportWhatsapp: { type: String, default: "+233 50 000 0000" },
    supportEmail: { type: String, default: "support@ipayghana.com" },
    storeAddress: { type: String, default: "Accra, Ghana" },
    socialLinks: { instagram: String, tiktok: String, x: String, facebook: String },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);
export const Setting = getModel<ISetting>("Setting", SettingSchema);

/* ---------- Development-only mock payment provider state ---------- */
export interface IMockCharge {
  _id: string; // payment reference
  amount: number;
  currency: string;
  status: "pending" | "success" | "failed" | "abandoned";
  channel: "mobile_money" | "card";
  refunded: number;
  updatedAt?: Date;
}
const MockChargeSchema = new Schema<IMockCharge>(
  {
    _id: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, default: "GHS" },
    status: { type: String, enum: ["pending", "success", "failed", "abandoned"], default: "pending" },
    channel: { type: String, enum: ["mobile_money", "card"], default: "mobile_money" },
    refunded: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);
export const MockCharge = getModel<IMockCharge>("MockCharge", MockChargeSchema);

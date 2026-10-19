import { Schema, type Types } from "mongoose";
import { PAYMENT_STATUSES, type PaymentStatus } from "@/lib/order-status";
import { getModel, makeAppendOnly, money } from "./_helpers";

export type PaymentKind = "deposit" | "installment" | "additional" | "full_balance" | "manual";

export interface IPayment {
  _id: Types.ObjectId;
  reference: string;
  providerReference?: string | null;
  customerId: Types.ObjectId;
  orderId: Types.ObjectId;
  orderNumber: string;
  installmentId?: Types.ObjectId | null; // primary installment targeted, if any
  kind: PaymentKind;
  amount: number; // requested / charged amount
  allocatedAmount: number; // portion applied to the order balance
  unallocatedAmount: number; // excess held for refund/review
  refundedAmount: number;
  currency: "GHS";
  method?: string | null; // mobile_money, card, bank, cash…
  channelDetail?: string | null; // e.g. "MTN MoMo •••1234"
  provider: "paystack" | "hubtel" | "mock" | "manual";
  isTest: boolean;
  status: PaymentStatus;
  failureReason?: string | null;
  reconciliationStatus: "unreconciled" | "matched" | "needs_review" | "resolved";
  checkoutUrl?: string | null;
  providerResponse?: Record<string, unknown> | null; // sanitized; never card numbers
  verifiedAt?: Date | null;
  expiresAt?: Date | null;
  recordedBy?: Types.ObjectId | null; // for manual payments
  manualReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    reference: { type: String, required: true },
    providerReference: { type: String, default: null },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    orderNumber: { type: String, required: true },
    installmentId: { type: Schema.Types.ObjectId, ref: "Installment", default: null },
    kind: { type: String, enum: ["deposit", "installment", "additional", "full_balance", "manual"], required: true },
    amount: money({ min: 1 }),
    allocatedAmount: money({ default: 0 }),
    unallocatedAmount: money({ default: 0 }),
    refundedAmount: money({ default: 0 }),
    currency: { type: String, enum: ["GHS"], default: "GHS" },
    method: { type: String, default: null },
    channelDetail: { type: String, default: null },
    provider: { type: String, enum: ["paystack", "hubtel", "mock", "manual"], required: true },
    isTest: { type: Boolean, default: false },
    status: { type: String, enum: PAYMENT_STATUSES, default: "pending" },
    failureReason: { type: String, default: null },
    reconciliationStatus: {
      type: String,
      enum: ["unreconciled", "matched", "needs_review", "resolved"],
      default: "unreconciled",
    },
    checkoutUrl: { type: String, default: null },
    providerResponse: { type: Schema.Types.Mixed, default: null },
    verifiedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    manualReason: { type: String, default: null },
  },
  { timestamps: true },
);

PaymentSchema.index({ reference: 1 }, { unique: true });
PaymentSchema.index({ providerReference: 1 }, { sparse: true });
PaymentSchema.index({ customerId: 1, createdAt: -1 });
PaymentSchema.index({ orderId: 1, createdAt: -1 });
PaymentSchema.index({ status: 1, verifiedAt: -1 });
PaymentSchema.index({ status: 1, expiresAt: 1 });
PaymentSchema.index({ reconciliationStatus: 1 });

export const Payment = getModel<IPayment>("Payment", PaymentSchema);

/** Which installment each confirmed payment (or refund) was applied to. Append-only. */
export interface IPaymentAllocation {
  _id: Types.ObjectId;
  paymentId: Types.ObjectId;
  orderId: Types.ObjectId;
  installmentId?: Types.ObjectId | null; // null for deposit
  installmentNumber: number; // 0 = deposit
  amount: number; // negative for refund/reversal unwinds
  refundId?: Types.ObjectId | null;
  createdAt: Date;
}
const PaymentAllocationSchema = new Schema<IPaymentAllocation>(
  {
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment", required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    installmentId: { type: Schema.Types.ObjectId, ref: "Installment", default: null, index: true },
    installmentNumber: { type: Number, required: true },
    amount: { type: Number, required: true, validate: Number.isSafeInteger },
    refundId: { type: Schema.Types.ObjectId, ref: "Refund", default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
makeAppendOnly(PaymentAllocationSchema, "PaymentAllocation");
export const PaymentAllocation = getModel<IPaymentAllocation>("PaymentAllocation", PaymentAllocationSchema);

/** The financial ledger. Order balances are projections of this collection. Append-only. */
export interface ILedgerEntry {
  _id: Types.ObjectId;
  orderId: Types.ObjectId;
  customerId: Types.ObjectId;
  paymentId?: Types.ObjectId | null;
  refundId?: Types.ObjectId | null;
  type: "payment" | "refund" | "reversal" | "manual_payment";
  amount: number; // signed pesewas applied to the order balance
  description: string;
  createdBy?: Types.ObjectId | null;
  isTest: boolean;
  createdAt: Date;
}
const LedgerEntrySchema = new Schema<ILedgerEntry>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment", default: null },
    refundId: { type: Schema.Types.ObjectId, ref: "Refund", default: null },
    type: { type: String, enum: ["payment", "refund", "reversal", "manual_payment"], required: true },
    amount: { type: Number, required: true, validate: Number.isSafeInteger },
    description: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    isTest: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
LedgerEntrySchema.index({ createdAt: -1 });
// A payment can be credited to the ledger at most once — second line of defence against double counting.
LedgerEntrySchema.index(
  { paymentId: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: { $in: ["payment", "manual_payment"] } } },
);
makeAppendOnly(LedgerEntrySchema, "LedgerEntry");
export const LedgerEntry = getModel<ILedgerEntry>("LedgerEntry", LedgerEntrySchema);

export interface IRefund {
  _id: Types.ObjectId;
  paymentId: Types.ObjectId;
  orderId: Types.ObjectId;
  customerId: Types.ObjectId;
  type: "refund" | "reversal";
  amount: number;
  appliedToBalance: number; // portion taken back from the order balance
  fromUnallocated: number; // portion returned from unallocated excess
  reason: string;
  status: "processed" | "pending" | "failed";
  providerReference?: string | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
}
const RefundSchema = new Schema<IRefund>(
  {
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment", required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["refund", "reversal"], required: true },
    amount: money({ min: 1 }),
    appliedToBalance: money({ default: 0 }),
    fromUnallocated: money({ default: 0 }),
    reason: { type: String, required: true, minlength: 5 },
    status: { type: String, enum: ["processed", "pending", "failed"], default: "processed" },
    providerReference: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
export const Refund = getModel<IRefund>("Refund", RefundSchema);

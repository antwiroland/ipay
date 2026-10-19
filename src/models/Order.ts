import { Schema, type Types } from "mongoose";
import { FULFILMENT_STATUSES, ORDER_STATUSES, type FulfilmentStatus, type OrderStatus } from "@/lib/order-status";
import type { RepaymentStatus } from "@/lib/allocation";
import type { PurchaseModel, RepaymentFrequency } from "@/lib/pricing";
import { getModel, money } from "./_helpers";

export interface IOrderStatusEvent {
  status: string;
  at: Date;
  by?: Types.ObjectId | null;
  note?: string;
}

export interface IOrder {
  _id: Types.ObjectId;
  orderNumber: string;
  customerId: Types.ObjectId;
  productId: Types.ObjectId;
  planId: Types.ObjectId;
  productSnapshot: {
    name: string;
    slug: string;
    model: string;
    storage: string;
    colour: string;
    condition: string;
    image: string;
    cashPrice: number;
    listInstallmentPrice: number;
  };
  planSnapshot: {
    name: string;
    code: string;
    purchaseModel: PurchaseModel;
    depositType: "percentage" | "fixed";
    depositValue: number;
    frequency: RepaymentFrequency;
    numberOfInstallments: number;
    markupBps: number;
    dueDayOfMonth?: number | null;
    gracePeriodDays: number;
    latePaymentPolicy: string;
    allowPartialPayments: boolean;
    allowAdditionalPayments: boolean;
    requiresVerification: boolean;
    requiresApproval: boolean;
    termsText: string;
  };
  pricing: {
    basePrice: number;
    promoApplied: boolean;
    addOns: { key: string; name: string; price: number }[];
    addOnsTotal: number;
    markup: number;
    fees: { name: string; amount: number }[];
    feesTotal: number;
    financed: number;
    installmentAmounts: number[];
  };
  costPriceSnapshot: number;
  agreedPurchasePrice: number;
  depositAmount: number;
  amountPaid: number; // cached projection of the ledger (net confirmed allocations)
  outstandingBalance: number; // cached projection
  orderStatus: OrderStatus;
  repaymentStatus: RepaymentStatus;
  fulfilmentStatus: FulfilmentStatus;
  isActive: boolean; // drives the one-active-order partial unique index
  agreedTermsVersion: string;
  termsAcceptedAt: Date;
  statusHistory: IOrderStatusEvent[];
  rejectionReason?: string | null;
  cancellationReason?: string | null;
  approvedAt?: Date | null;
  approvedBy?: Types.ObjectId | null;
  depositPaidAt?: Date | null;
  activatedAt?: Date | null; // = deposit confirmation, sale recognised
  fullyPaidAt?: Date | null;
  collectedAt?: Date | null;
  completedAt?: Date | null;
  nextDueDate?: Date | null;
  nextDueAmount?: number | null;
  suspendedFromStatus?: OrderStatus | null;
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    planId: { type: Schema.Types.ObjectId, ref: "PaymentPlan", required: true },
    productSnapshot: {
      name: String,
      slug: String,
      model: String,
      storage: String,
      colour: String,
      condition: String,
      image: String,
      cashPrice: Number,
      listInstallmentPrice: Number,
    },
    planSnapshot: {
      name: String,
      code: String,
      purchaseModel: { type: String, enum: ["take_and_pay", "pay_small_small"] },
      depositType: String,
      depositValue: Number,
      frequency: String,
      numberOfInstallments: Number,
      markupBps: Number,
      dueDayOfMonth: Number,
      gracePeriodDays: Number,
      latePaymentPolicy: String,
      allowPartialPayments: Boolean,
      allowAdditionalPayments: Boolean,
      requiresVerification: Boolean,
      requiresApproval: Boolean,
      termsText: String,
    },
    pricing: {
      basePrice: Number,
      promoApplied: Boolean,
      addOns: [{ _id: false, key: String, name: String, price: Number }],
      addOnsTotal: Number,
      markup: Number,
      fees: [{ _id: false, name: String, amount: Number }],
      feesTotal: Number,
      financed: Number,
      installmentAmounts: [Number],
    },
    costPriceSnapshot: money({ default: 0 }),
    agreedPurchasePrice: money(),
    depositAmount: money(),
    amountPaid: money({ default: 0 }),
    outstandingBalance: money(),
    orderStatus: { type: String, enum: ORDER_STATUSES, required: true },
    repaymentStatus: {
      type: String,
      enum: ["not_started", "current", "due_soon", "overdue", "partially_paid", "fully_paid"],
      default: "not_started",
    },
    fulfilmentStatus: { type: String, enum: FULFILMENT_STATUSES, default: "not_prepared" },
    isActive: { type: Boolean, required: true },
    agreedTermsVersion: { type: String, required: true },
    termsAcceptedAt: { type: Date, required: true },
    statusHistory: [
      { _id: false, status: String, at: Date, by: { type: Schema.Types.ObjectId, ref: "User" }, note: String },
    ],
    rejectionReason: { type: String, default: null },
    cancellationReason: { type: String, default: null },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    depositPaidAt: { type: Date, default: null },
    activatedAt: { type: Date, default: null },
    fullyPaidAt: { type: Date, default: null },
    collectedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    nextDueDate: { type: Date, default: null },
    nextDueAmount: { type: Number, default: null },
    suspendedFromStatus: { type: String, enum: [...ORDER_STATUSES, null], default: null },
  },
  { timestamps: true },
);

OrderSchema.index({ orderNumber: 1 }, { unique: true });
/** THE one-active-installment-order-per-customer guarantee. */
OrderSchema.index(
  { customerId: 1 },
  { unique: true, partialFilterExpression: { isActive: true }, name: "one_active_order_per_customer" },
);
OrderSchema.index({ customerId: 1, createdAt: -1 });
OrderSchema.index({ orderStatus: 1, createdAt: -1 });
OrderSchema.index({ repaymentStatus: 1 });
OrderSchema.index({ activatedAt: 1 });
OrderSchema.index({ nextDueDate: 1 });

export const Order = getModel<IOrder>("Order", OrderSchema);

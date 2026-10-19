import { Schema, type Types } from "mongoose";
import type { PurchaseModel, RepaymentFrequency } from "@/lib/pricing";
import { getModel, money } from "./_helpers";

export interface IPaymentPlan {
  _id: Types.ObjectId;
  name: string;
  code: string;
  description: string;
  purchaseModel: PurchaseModel;
  depositType: "percentage" | "fixed";
  depositValue: number; // bps or pesewas
  frequency: RepaymentFrequency;
  numberOfInstallments: number;
  markupBps: number;
  fees: { name: string; amount: number }[];
  dueDayOfMonth?: number | null;
  gracePeriodDays: number;
  latePaymentPolicy: string;
  eligibility: { requiresVerification: boolean; requiresApproval: boolean; minAccountAgeDays: number };
  allowPartialPayments: boolean;
  allowAdditionalPayments: boolean;
  termsVersion: string;
  termsText: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentPlanSchema = new Schema<IPaymentPlan>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, default: "" },
    purchaseModel: { type: String, enum: ["take_and_pay", "pay_small_small"], required: true },
    depositType: { type: String, enum: ["percentage", "fixed"], required: true },
    depositValue: { type: Number, required: true, min: 1, validate: Number.isInteger },
    frequency: { type: String, enum: ["weekly", "monthly"], required: true },
    numberOfInstallments: { type: Number, required: true, min: 1, max: 104, validate: Number.isInteger },
    markupBps: { type: Number, default: 0, min: 0, max: 10000, validate: Number.isInteger },
    fees: [{ _id: false, name: { type: String, required: true }, amount: money() }],
    dueDayOfMonth: { type: Number, min: 1, max: 28, default: null },
    gracePeriodDays: { type: Number, default: 3, min: 0, max: 30 },
    latePaymentPolicy: { type: String, default: "" },
    eligibility: {
      requiresVerification: { type: Boolean, default: true },
      requiresApproval: { type: Boolean, default: true },
      minAccountAgeDays: { type: Number, default: 0, min: 0 },
    },
    allowPartialPayments: { type: Boolean, default: true },
    allowAdditionalPayments: { type: Boolean, default: true },
    termsVersion: { type: String, required: true },
    termsText: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

PaymentPlanSchema.index({ code: 1 }, { unique: true });
PaymentPlanSchema.index({ isActive: 1, sortOrder: 1 });

PaymentPlanSchema.pre("validate", function () {
  if (this.depositType === "percentage" && this.depositValue >= 10000) {
    this.invalidate("depositValue", "Deposit percentage must be below 100%");
  }
});

export const PaymentPlan = getModel<IPaymentPlan>("PaymentPlan", PaymentPlanSchema);

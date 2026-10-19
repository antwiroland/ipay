import { Schema, type Types } from "mongoose";
import type { InstallmentStatus } from "@/lib/allocation";
import { getModel, money } from "./_helpers";

export interface IInstallment {
  _id: Types.ObjectId;
  orderId: Types.ObjectId;
  customerId: Types.ObjectId;
  orderNumber: string;
  installmentNumber: number;
  dueDate: Date;
  amountDue: number;
  amountPaid: number;
  outstandingAmount: number;
  status: InstallmentStatus;
  paidAt?: Date | null;
  lastPaymentAt?: Date | null;
  lastPaymentReference?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const InstallmentSchema = new Schema<IInstallment>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    orderNumber: { type: String, required: true },
    installmentNumber: { type: Number, required: true, min: 1 },
    dueDate: { type: Date, required: true },
    amountDue: money(),
    amountPaid: money({ default: 0 }),
    outstandingAmount: money(),
    status: {
      type: String,
      enum: ["upcoming", "due", "partially_paid", "paid", "overdue", "cancelled"],
      default: "upcoming",
    },
    paidAt: { type: Date, default: null },
    lastPaymentAt: { type: Date, default: null },
    lastPaymentReference: { type: String, default: null },
  },
  { timestamps: true },
);

InstallmentSchema.index({ orderId: 1, installmentNumber: 1 }, { unique: true });
InstallmentSchema.index({ customerId: 1, dueDate: 1 });
InstallmentSchema.index({ status: 1, dueDate: 1 });
InstallmentSchema.index({ dueDate: 1, outstandingAmount: 1 });

InstallmentSchema.pre("validate", function () {
  if (this.amountPaid > this.amountDue) this.invalidate("amountPaid", "Installment cannot be over-allocated");
});

export const Installment = getModel<IInstallment>("Installment", InstallmentSchema);

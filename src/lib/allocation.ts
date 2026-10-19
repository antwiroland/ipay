/**
 * Payment allocation policy (documented to customers in the plan terms):
 *  - Payments settle the OLDEST outstanding installment first, then roll over into the next one(s).
 *  - Any amount above the order's total outstanding balance is NOT allocated; it is held for refund/review.
 *  - Refunds/reversals unwind allocations from the NEWEST installment backwards.
 */
import type { Pesewas } from "./money";

export interface AllocatableInstallment {
  id: string;
  installmentNumber: number;
  amountDue: Pesewas;
  amountPaid: Pesewas;
  cancelled?: boolean;
}

export interface Allocation {
  installmentId: string;
  installmentNumber: number;
  amount: Pesewas;
}

export function allocatePayment(
  amount: Pesewas,
  installments: AllocatableInstallment[],
): { allocations: Allocation[]; unallocated: Pesewas } {
  let remaining = amount;
  const allocations: Allocation[] = [];
  const ordered = [...installments].filter((i) => !i.cancelled).sort((a, b) => a.installmentNumber - b.installmentNumber);
  for (const inst of ordered) {
    if (remaining <= 0) break;
    const open = inst.amountDue - inst.amountPaid;
    if (open <= 0) continue;
    const take = Math.min(open, remaining);
    allocations.push({ installmentId: inst.id, installmentNumber: inst.installmentNumber, amount: take });
    remaining -= take;
  }
  return { allocations, unallocated: remaining };
}

export function unwindAllocations(
  amount: Pesewas,
  installments: AllocatableInstallment[],
): { allocations: Allocation[]; unresolved: Pesewas } {
  let remaining = amount;
  const allocations: Allocation[] = [];
  const ordered = [...installments].sort((a, b) => b.installmentNumber - a.installmentNumber);
  for (const inst of ordered) {
    if (remaining <= 0) break;
    if (inst.amountPaid <= 0) continue;
    const take = Math.min(inst.amountPaid, remaining);
    allocations.push({ installmentId: inst.id, installmentNumber: inst.installmentNumber, amount: -take });
    remaining -= take;
  }
  return { allocations, unresolved: remaining };
}

export type InstallmentStatus = "upcoming" | "due" | "partially_paid" | "paid" | "overdue" | "cancelled";

export const DUE_SOON_DAYS = 3;

/** Derive the display/query status of an installment from amounts and dates. */
export function deriveInstallmentStatus(
  inst: { amountDue: Pesewas; amountPaid: Pesewas; dueDate: Date; cancelled?: boolean },
  now: Date,
  graceDays = 0,
): InstallmentStatus {
  if (inst.cancelled) return "cancelled";
  if (inst.amountPaid >= inst.amountDue) return "paid";
  const due = new Date(inst.dueDate).getTime();
  const overdueAt = due + (graceDays + 1) * 86400000; // overdue after the end of the due day + grace
  if (now.getTime() >= overdueAt) return "overdue";
  if (inst.amountPaid > 0) return "partially_paid";
  if (due - now.getTime() <= DUE_SOON_DAYS * 86400000) return "due";
  return "upcoming";
}

export type RepaymentStatus = "not_started" | "current" | "due_soon" | "overdue" | "partially_paid" | "fully_paid";

export function deriveRepaymentStatus(
  input: {
    depositPaid: boolean;
    outstanding: Pesewas;
    installments: { amountDue: Pesewas; amountPaid: Pesewas; dueDate: Date; cancelled?: boolean }[];
  },
  now: Date,
  graceDays = 0,
): RepaymentStatus {
  if (!input.depositPaid) return "not_started";
  if (input.outstanding <= 0) return "fully_paid";
  const statuses = input.installments.map((i) => deriveInstallmentStatus(i, now, graceDays));
  if (statuses.includes("overdue")) return "overdue";
  if (statuses.includes("due")) return "due_soon";
  if (statuses.includes("partially_paid")) return "partially_paid";
  return "current";
}

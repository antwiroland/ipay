/**
 * Contract maths — the single source of truth for installment pricing.
 * Used for display (calculator) AND recomputed server-side when an order is created.
 * Pure: no database, no framework imports.
 */
import { addDays, addMonthsClamped, startOfUtcDay } from "./dates";
import { type Pesewas, roundBps, splitEvenly, sum } from "./money";

export type PurchaseModel = "take_and_pay" | "pay_small_small";
export type RepaymentFrequency = "weekly" | "monthly";

export interface PricingProduct {
  cashPrice: Pesewas;
  installmentPrice: Pesewas;
  promoInstallmentPrice?: Pesewas | null;
  promoCashPrice?: Pesewas | null;
  promoStartsAt?: Date | string | null;
  promoEndsAt?: Date | string | null;
  addOns?: { key: string; name: string; price: Pesewas }[];
}

export interface PricingPlan {
  purchaseModel: PurchaseModel;
  depositType: "percentage" | "fixed";
  /** bps when percentage, pesewas when fixed */
  depositValue: number;
  frequency: RepaymentFrequency;
  numberOfInstallments: number;
  markupBps: number;
  fees: { name: string; amount: Pesewas }[];
  /** monthly only: fixed day of month (1–28). null = anniversary of start date */
  dueDayOfMonth?: number | null;
}

export interface CampaignDiscount {
  discountBps: number;
}

export interface Quote {
  basePrice: Pesewas; // effective installment price after promos
  listInstallmentPrice: Pesewas;
  cashPrice: Pesewas;
  promoApplied: boolean;
  addOns: { key: string; name: string; price: Pesewas }[];
  addOnsTotal: Pesewas;
  markup: Pesewas;
  fees: { name: string; amount: Pesewas }[];
  feesTotal: Pesewas;
  contractPrice: Pesewas; // agreed purchase price (total payable)
  deposit: Pesewas;
  financed: Pesewas;
  installmentAmounts: Pesewas[];
  regularInstallment: Pesewas;
  finalInstallment: Pesewas;
  numberOfInstallments: number;
  frequency: RepaymentFrequency;
}

function inWindow(now: Date, start?: Date | string | null, end?: Date | string | null): boolean {
  if (start && new Date(start) > now) return false;
  if (end && new Date(end) < now) return false;
  return true;
}

export function isPromoActive(p: PricingProduct, now = new Date()): boolean {
  return (
    p.promoInstallmentPrice != null &&
    p.promoInstallmentPrice > 0 &&
    (p.promoStartsAt != null || p.promoEndsAt != null) &&
    inWindow(now, p.promoStartsAt, p.promoEndsAt)
  );
}

export function effectiveInstallmentPrice(
  p: PricingProduct,
  now = new Date(),
  campaign?: CampaignDiscount | null,
): { price: Pesewas; promoApplied: boolean } {
  let price = p.installmentPrice;
  let promoApplied = false;
  if (isPromoActive(p, now) && p.promoInstallmentPrice! < price) {
    price = p.promoInstallmentPrice!;
    promoApplied = true;
  }
  if (campaign && campaign.discountBps > 0) {
    price = price - roundBps(price, campaign.discountBps);
    promoApplied = true;
  }
  return { price, promoApplied };
}

export function effectiveCashPrice(p: PricingProduct, now = new Date()): Pesewas {
  if (p.promoCashPrice && p.promoCashPrice > 0 && inWindow(now, p.promoStartsAt, p.promoEndsAt) && (p.promoStartsAt || p.promoEndsAt)) {
    return Math.min(p.promoCashPrice, p.cashPrice);
  }
  return p.cashPrice;
}

export class PricingError extends Error {}

export function quote(
  product: PricingProduct,
  plan: PricingPlan,
  opts: { addOnKeys?: string[]; now?: Date; campaign?: CampaignDiscount | null } = {},
): Quote {
  const now = opts.now ?? new Date();
  const { price: basePrice, promoApplied } = effectiveInstallmentPrice(product, now, opts.campaign);

  const keys = new Set(opts.addOnKeys ?? []);
  const addOns = (product.addOns ?? []).filter((a) => keys.has(a.key));
  if (addOns.length !== keys.size) throw new PricingError("Unknown add-on selected");
  const addOnsTotal = sum(addOns.map((a) => a.price));

  const markup = roundBps(basePrice + addOnsTotal, plan.markupBps);
  const feesTotal = sum(plan.fees.map((f) => f.amount));
  const contractPrice = basePrice + addOnsTotal + markup + feesTotal;

  let deposit: Pesewas;
  if (plan.depositType === "percentage") {
    if (plan.depositValue < 0 || plan.depositValue > 10000) throw new PricingError("Deposit percentage out of range");
    deposit = roundBps(contractPrice, plan.depositValue);
  } else {
    deposit = Math.min(plan.depositValue, contractPrice);
  }
  if (deposit <= 0) throw new PricingError("A deposit is required");

  const financed = contractPrice - deposit;
  const installmentAmounts = financed > 0 ? splitEvenly(financed, plan.numberOfInstallments) : [];

  return {
    basePrice,
    listInstallmentPrice: product.installmentPrice,
    cashPrice: effectiveCashPrice(product, now),
    promoApplied,
    addOns,
    addOnsTotal,
    markup,
    fees: plan.fees,
    feesTotal,
    contractPrice,
    deposit,
    financed,
    installmentAmounts,
    regularInstallment: installmentAmounts[0] ?? 0,
    finalInstallment: installmentAmounts[installmentAmounts.length - 1] ?? 0,
    numberOfInstallments: installmentAmounts.length,
    frequency: plan.frequency,
  };
}

/** Due dates for a schedule starting at `start` (deposit confirmation). First due one period later. */
export function scheduleDueDates(
  start: Date,
  plan: Pick<PricingPlan, "frequency" | "numberOfInstallments" | "dueDayOfMonth">,
): Date[] {
  const s = startOfUtcDay(start);
  const dates: Date[] = [];
  for (let i = 1; i <= plan.numberOfInstallments; i++) {
    if (plan.frequency === "weekly") {
      dates.push(addDays(s, 7 * i));
    } else if (plan.dueDayOfMonth) {
      // Fixed day of month: first due date is the next occurrence at least 14 days after start.
      let first = addMonthsClamped(new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 1)), 0, plan.dueDayOfMonth);
      while (first.getTime() - s.getTime() < 14 * 24 * 3600 * 1000) first = addMonthsClamped(first, 1, plan.dueDayOfMonth);
      dates.push(addMonthsClamped(first, i - 1, plan.dueDayOfMonth));
    } else {
      dates.push(addMonthsClamped(s, i, s.getUTCDate()));
    }
  }
  return dates;
}

export function frequencyLabel(f: RepaymentFrequency, n?: number): string {
  const unit = f === "weekly" ? "week" : "month";
  if (n == null) return f === "weekly" ? "Weekly" : "Monthly";
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

export const PURCHASE_MODEL_LABEL: Record<PurchaseModel, string> = {
  take_and_pay: "Take & Pay",
  pay_small_small: "Pay Small-Small",
};

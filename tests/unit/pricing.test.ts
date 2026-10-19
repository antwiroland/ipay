import { describe, expect, it } from "vitest";
import { addMonthsClamped } from "@/lib/dates";
import { PricingError, quote, scheduleDueDates, type PricingPlan, type PricingProduct } from "@/lib/pricing";

const iphone13: PricingProduct = { cashPrice: 550000, installmentPrice: 660000 };
const weekly12: PricingPlan = {
  purchaseModel: "take_and_pay",
  depositType: "percentage",
  depositValue: 4000,
  frequency: "weekly",
  numberOfInstallments: 12,
  markupBps: 0,
  fees: [],
};

describe("quote", () => {
  it("reproduces the specification example exactly", () => {
    const q = quote(iphone13, weekly12);
    expect(q.contractPrice).toBe(660000); // GH₵6,600.00
    expect(q.deposit).toBe(264000); // GH₵2,640.00
    expect(q.financed).toBe(396000); // GH₵3,960.00
    expect(q.regularInstallment).toBe(33000); // GH₵330.00
    expect(q.installmentAmounts).toHaveLength(12);
    expect(q.installmentAmounts.reduce((a, b) => a + b)).toBe(q.financed);
  });

  it("includes markup, fees and add-ons in the contract price and reconciles", () => {
    const q = quote(
      { ...iphone13, addOns: [{ key: "case", name: "Case", price: 15000 }] },
      { ...weekly12, markupBps: 500, fees: [{ name: "Admin fee", amount: 5000 }], numberOfInstallments: 7 },
      { addOnKeys: ["case"] },
    );
    expect(q.addOnsTotal).toBe(15000);
    expect(q.markup).toBe(Math.round((675000 * 500) / 10000)); // 33750
    expect(q.contractPrice).toBe(660000 + 15000 + 33750 + 5000);
    expect(q.deposit + q.installmentAmounts.reduce((a, b) => a + b)).toBe(q.contractPrice);
  });

  it("applies promo prices only inside their window", () => {
    const now = new Date("2026-10-19T12:00:00Z");
    const promo = { ...iphone13, promoInstallmentPrice: 600000, promoStartsAt: "2026-10-01", promoEndsAt: "2026-10-31" };
    expect(quote(promo, weekly12, { now }).contractPrice).toBe(600000);
    expect(quote(promo, weekly12, { now: new Date("2026-11-05") }).contractPrice).toBe(660000);
  });

  it("applies campaign discounts on top", () => {
    const q = quote(iphone13, weekly12, { campaign: { discountBps: 1000 } });
    expect(q.contractPrice).toBe(594000);
    expect(q.promoApplied).toBe(true);
  });

  it("supports fixed deposits, capped at the contract price", () => {
    const q = quote(iphone13, { ...weekly12, depositType: "fixed", depositValue: 100000 });
    expect(q.deposit).toBe(100000);
    expect(q.financed).toBe(560000);
  });

  it("rejects unknown add-ons", () => {
    expect(() => quote(iphone13, weekly12, { addOnKeys: ["nope"] })).toThrow(PricingError);
  });
});

describe("schedule dates", () => {
  it("weekly: one week apart starting a week after the deposit", () => {
    const d = scheduleDueDates(new Date("2026-10-19T15:30:00Z"), { frequency: "weekly", numberOfInstallments: 3 });
    expect(d.map((x) => x.toISOString().slice(0, 10))).toEqual(["2026-10-26", "2026-11-02", "2026-11-09"]);
  });

  it("monthly anniversary clamps to month end", () => {
    const d = scheduleDueDates(new Date("2026-01-31T00:00:00Z"), { frequency: "monthly", numberOfInstallments: 3 });
    expect(d.map((x) => x.toISOString().slice(0, 10))).toEqual(["2026-02-28", "2026-03-31", "2026-04-30"]);
    expect(addMonthsClamped(new Date("2028-01-31"), 1).toISOString().slice(0, 10)).toBe("2028-02-29");
  });

  it("monthly fixed due day starts at least 14 days after the deposit", () => {
    const d = scheduleDueDates(new Date("2026-10-19T00:00:00Z"), { frequency: "monthly", numberOfInstallments: 2, dueDayOfMonth: 25 });
    expect(d.map((x) => x.toISOString().slice(0, 10))).toEqual(["2026-11-25", "2026-12-25"]);
  });
});

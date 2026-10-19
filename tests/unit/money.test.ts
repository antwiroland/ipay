import { describe, expect, it } from "vitest";
import { cedisToPesewas, clampOutstanding, formatGHS, progressPercent, roundBps, splitEvenly } from "@/lib/money";

describe("money", () => {
  it("formats Ghana cedis", () => {
    expect(formatGHS(660000)).toBe("GH₵6,600.00");
    expect(formatGHS(0)).toBe("GH₵0.00");
    expect(formatGHS(5)).toBe("GH₵0.05");
    expect(formatGHS(123456789)).toBe("GH₵1,234,567.89");
    expect(formatGHS(-1050)).toBe("-GH₵10.50");
  });

  it("parses cedi strings exactly (no floating point)", () => {
    expect(cedisToPesewas("6,600")).toBe(660000);
    expect(cedisToPesewas("0.1")).toBe(10);
    expect(cedisToPesewas("19.99")).toBe(1999);
    expect(cedisToPesewas(0.3)).toBe(30);
    expect(() => cedisToPesewas("1.234")).toThrow();
    expect(() => cedisToPesewas("abc")).toThrow();
  });

  it("rounds basis points half-up with integers only", () => {
    expect(roundBps(660000, 4000)).toBe(264000);
    expect(roundBps(999, 5000)).toBe(500); // 499.5 → 500
    expect(roundBps(997, 5000)).toBe(499); // 498.5 → 499
    expect(roundBps(1, 4999)).toBe(0);
  });

  it("splits so parts always sum to the total; last part absorbs remainder", () => {
    expect(splitEvenly(396000, 12)).toEqual(Array(12).fill(33000));
    const parts = splitEvenly(100001, 3);
    expect(parts).toEqual([33333, 33333, 33335]);
    expect(parts.reduce((a, b) => a + b)).toBe(100001);
    for (let n = 1; n <= 52; n++) {
      const total = 123457 + n * 13;
      expect(splitEvenly(total, n).reduce((a, b) => a + b)).toBe(total);
    }
  });

  it("computes progress and never-negative outstanding", () => {
    expect(progressPercent(396000, 660000)).toBe(60);
    expect(progressPercent(660000, 660000)).toBe(100);
    expect(progressPercent(700000, 660000)).toBe(100);
    expect(progressPercent(1, 3)).toBe(33.3);
    expect(clampOutstanding(660000, 700000)).toBe(0);
  });
});

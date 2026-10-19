/**
 * Money helpers. All amounts are integer pesewas (GH₵1.00 = 100).
 * Percentages are basis points (1% = 100 bps).
 */

export type Pesewas = number;

export function assertPesewas(value: number, label = "amount"): asserts value is Pesewas {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be an integer number of pesewas (got ${value})`);
  }
}

/** Convert a cedi amount entered by a human ("6,600.50" or 6600.5) into pesewas, exactly. */
export function cedisToPesewas(input: string | number): Pesewas {
  const raw = typeof input === "number" ? input.toFixed(2) : input.replace(/[,\s]/g, "").replace(/^GH₵/i, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(raw)) throw new Error(`Invalid cedi amount: ${input}`);
  const negative = raw.startsWith("-");
  const [whole, frac = ""] = raw.replace("-", "").split(".");
  const value = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return negative ? -value : value;
}

export function pesewasToCedisString(amount: Pesewas): string {
  assertPesewas(amount);
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const s = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  return negative ? `-${s}` : s;
}

/** GH₵6,600.00 */
export function formatGHS(amount: Pesewas, opts: { compact?: boolean } = {}): string {
  assertPesewas(amount);
  const negative = amount < 0;
  const abs = Math.abs(amount);
  if (opts.compact && abs >= 100_000_00) {
    const cedis = abs / 100;
    const units: [number, string][] = [
      [1e9, "B"],
      [1e6, "M"],
      [1e3, "K"],
    ];
    for (const [div, suffix] of units) {
      if (cedis >= div) return `${negative ? "-" : ""}GH₵${(cedis / div).toFixed(1).replace(/\.0$/, "")}${suffix}`;
    }
  }
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = String(abs % 100).padStart(2, "0");
  return `${negative ? "-" : ""}GH₵${whole}.${frac}`;
}

/** amount × bps / 10000, rounded half-up, integer-only. */
export function roundBps(amount: Pesewas, bps: number): Pesewas {
  assertPesewas(amount);
  if (!Number.isSafeInteger(bps)) throw new Error("bps must be an integer");
  const product = amount * bps;
  const q = Math.floor(product / 10000);
  const r = product - q * 10000;
  return r * 2 >= 10000 ? q + 1 : q;
}

/**
 * Split `total` into `n` integer parts. All parts equal `floor(total/n)` except the final part,
 * which absorbs the remainder, so the parts always sum to `total` exactly.
 */
export function splitEvenly(total: Pesewas, n: number): Pesewas[] {
  assertPesewas(total);
  if (!Number.isInteger(n) || n < 1) throw new Error("n must be a positive integer");
  if (total < 0) throw new Error("total must be non-negative");
  const base = Math.floor(total / n);
  const parts = Array.from({ length: n }, () => base);
  parts[n - 1] += total - base * n;
  return parts;
}

export function sum(values: Pesewas[]): Pesewas {
  return values.reduce((a, b) => a + b, 0);
}

/** progress percentage with one decimal, clamped to [0, 100]. */
export function progressPercent(paid: Pesewas, total: Pesewas): number {
  if (total <= 0) return 0;
  const pct = Math.floor((Math.max(0, paid) * 1000) / total) / 10;
  return Math.min(100, pct);
}

export function clampOutstanding(total: Pesewas, paid: Pesewas): Pesewas {
  return Math.max(0, total - paid);
}

import { mockProvider } from "./mock";
import { paystackProvider } from "./paystack";
import type { PaymentProvider, ProviderName } from "./types";

export function mockPaymentsAllowed() {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_MOCK_PAYMENTS === "true";
}

/** The provider used for NEW payments. */
export function activeProvider(): PaymentProvider {
  const name = (process.env.PAYMENT_PROVIDER || "mock") as ProviderName;
  if (name === "paystack") return paystackProvider;
  if (name === "mock") {
    if (!mockPaymentsAllowed()) {
      throw new Error("The mock payment provider is disabled in production. Configure PAYMENT_PROVIDER=paystack.");
    }
    return mockProvider;
  }
  throw new Error(`Unsupported PAYMENT_PROVIDER "${name}"`);
}

/** The provider that processed an EXISTING payment (needed for verify/refund). */
export function providerFor(name: string): PaymentProvider {
  if (name === "paystack") return paystackProvider;
  if (name === "mock") {
    if (!mockPaymentsAllowed()) throw new Error("Mock payments cannot be processed in production.");
    return mockProvider;
  }
  throw new Error(`No adapter for provider "${name}"`);
}

export function isSandboxMode() {
  try {
    return activeProvider().isTest;
  } catch {
    return false;
  }
}

/** Paystack with an sk_test_ key: real gateway, test money (as opposed to the fully simulated mock). */
export function isPaystackTestMode() {
  try {
    const p = activeProvider();
    return p.name === "paystack" && p.isTest;
  } catch {
    return false;
  }
}

export type { PaymentProvider } from "./types";

import mongoose from "mongoose";
import * as models from "@/models";
import { PaymentPlan, Product, User } from "@/models";
import type { Role } from "@/lib/permissions";
import type { Actor } from "@/server/auth/actor";
import { hashPassword } from "@/server/auth/crypto";
import { connectDB } from "@/server/db";
import { setMockOutcome } from "@/server/payments/mock";
import { TERMS_VERSION, toActor } from "@/server/services/auth";
import { confirmPayment, initiatePayment } from "@/server/services/payments";

export const APP_URL = "http://localhost:3000";

/** Connect and build every index up front (the one-active-order guarantee is an index). */
export async function setupDb() {
  await connectDB();
  for (const m of Object.values(models)) {
    if (m && typeof m === "function" && "init" in m && "modelName" in m) {
      await (m as unknown as mongoose.Model<unknown>).createCollection().catch(() => undefined);
      await (m as unknown as mongoose.Model<unknown>).init();
    }
  }
}

let seq = 0;
export async function makeUser(role: Role = "customer", overrides: Partial<models.IUser> = {}): Promise<Actor> {
  seq++;
  const now = new Date();
  const u = await User.create({
    name: `Test ${role} ${seq}`,
    // Deterministic per file (each test file has its own database), so unique indexes never collide.
    email: `user${seq}@example.com`,
    phone: `+23324${String(1000000 + seq).slice(-7)}`,
    passwordHash: await hashPassword("Password123"),
    role,
    verificationStatus: "verified",
    consents: { termsAcceptedAt: now, privacyAcceptedAt: now, termsVersion: TERMS_VERSION },
    ...overrides,
  });
  return toActor(u, true);
}

export async function makePlan(overrides: Partial<models.IPaymentPlan> = {}) {
  seq++;
  return PaymentPlan.create({
    name: "12 Weeks",
    code: `weekly-12-${seq}`,
    purchaseModel: "take_and_pay",
    depositType: "percentage",
    depositValue: 4000,
    frequency: "weekly",
    numberOfInstallments: 12,
    markupBps: 0,
    fees: [],
    gracePeriodDays: 3,
    eligibility: { requiresVerification: true, requiresApproval: false, minAccountAgeDays: 0 },
    allowPartialPayments: true,
    allowAdditionalPayments: true,
    termsVersion: "v1",
    termsText: "Standard installment agreement terms for testing purposes.",
    isActive: true,
    ...overrides,
  });
}

export async function makeProduct(overrides: Partial<models.IProduct> = {}) {
  seq++;
  return Product.create({
    name: "iPhone 13 128GB",
    slug: `iphone-13-128gb-${seq}`,
    model: "iPhone 13",
    series: 13,
    storage: "128GB",
    storageGb: 128,
    colourOptions: [{ name: "Midnight", hex: "#1f2430" }],
    condition: "uk_used",
    images: [{ url: "/images/devices/iphone-13-midnight.svg", alt: "iPhone 13" }],
    cashPrice: 550000,
    installmentPrice: 660000,
    costPrice: 450000,
    stockQuantity: 5,
    isPublished: true,
    ...overrides,
  });
}

export function orderInput(productId: string, planId: string, extra: Record<string, unknown> = {}) {
  return { productId, planId, colour: "Midnight", acceptTerms: true, termsVersion: "v1", ...extra };
}

/** Initiate + complete a sandbox checkout, returning the payment reference. */
export async function pay(actor: Actor, orderId: string, kind: "deposit" | "installment" | "additional" | "full_balance", amount?: string) {
  const r = await initiatePayment(actor, { orderId, kind, amount }, APP_URL);
  await setMockOutcome(r.reference, "success");
  const outcome = await confirmPayment(r.reference);
  return { ...r, outcome };
}

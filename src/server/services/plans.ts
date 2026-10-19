import { z } from "zod";
import { cediAmountSchema } from "@/lib/validation";
import { PaymentPlan } from "@/models";
import { type Actor, requirePermission } from "../auth/actor";
import { connectDB, isDuplicateKeyError } from "../db";
import { AppError } from "../errors";
import { audit } from "./audit";
import { parseOrThrow } from "./auth";

export const planInputSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    code: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,40}$/),
    description: z.string().trim().max(500).default(""),
    purchaseModel: z.enum(["take_and_pay", "pay_small_small"]),
    depositType: z.enum(["percentage", "fixed"]),
    /** percentage (e.g. "40") when percentage; cedis when fixed */
    depositValue: z.union([z.string(), z.number()]),
    frequency: z.enum(["weekly", "monthly"]),
    numberOfInstallments: z.coerce.number().int().min(1).max(104),
    markupPercent: z.coerce.number().min(0).max(100).default(0),
    fees: z.array(z.object({ name: z.string().trim().min(2).max(60), amount: cediAmountSchema })).max(5).default([]),
    dueDayOfMonth: z.union([z.literal(""), z.null(), z.coerce.number().int().min(1).max(28)]).transform((v) => (v === "" ? null : v)).default(null),
    gracePeriodDays: z.coerce.number().int().min(0).max(30).default(3),
    latePaymentPolicy: z.string().trim().max(1000).default(""),
    requiresVerification: z.boolean().default(true),
    requiresApproval: z.boolean().default(true),
    minAccountAgeDays: z.coerce.number().int().min(0).max(365).default(0),
    allowPartialPayments: z.boolean().default(true),
    allowAdditionalPayments: z.boolean().default(true),
    termsVersion: z.string().trim().min(1).max(40),
    termsText: z.string().trim().min(20, "Terms must be written out in full").max(20000),
    isActive: z.boolean().default(true),
    sortOrder: z.coerce.number().int().default(0),
  })
  .transform((v, ctx) => {
    let depositValue: number;
    if (v.depositType === "percentage") {
      const pct = Number(v.depositValue);
      if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) {
        ctx.addIssue({ code: "custom", path: ["depositValue"], message: "Deposit percentage must be between 0 and 100" });
        return z.NEVER;
      }
      depositValue = Math.round(pct * 100);
    } else {
      const r = cediAmountSchema.safeParse(v.depositValue);
      if (!r.success || r.data <= 0) {
        ctx.addIssue({ code: "custom", path: ["depositValue"], message: "Enter a fixed deposit amount" });
        return z.NEVER;
      }
      depositValue = r.data;
    }
    if (v.frequency === "weekly" && v.dueDayOfMonth) {
      ctx.addIssue({ code: "custom", path: ["dueDayOfMonth"], message: "Due day of month applies to monthly plans only" });
      return z.NEVER;
    }
    const { markupPercent, requiresVerification, requiresApproval, minAccountAgeDays, ...rest } = v;
    return {
      ...rest,
      depositValue,
      markupBps: Math.round(markupPercent * 100),
      eligibility: { requiresVerification, requiresApproval, minAccountAgeDays },
    };
  });

export async function savePlan(actor: Actor, planId: string | null, input: unknown) {
  requirePermission(actor, "plans.manage");
  const data = parseOrThrow(planInputSchema, input);
  await connectDB();
  try {
    if (!planId) {
      const plan = await PaymentPlan.create(data);
      await audit(actor, "plan.create", "PaymentPlan", plan._id.toString(), { metadata: { code: plan.code } });
      return plan;
    }
    const before = await PaymentPlan.findById(planId).lean();
    if (!before) throw new AppError("NOT_FOUND", "Plan not found.");
    // Contract-affecting changes require a new terms version so customers re-accept. Existing orders are unaffected (snapshots).
    const contractChanged =
      before.depositType !== data.depositType ||
      before.depositValue !== data.depositValue ||
      before.numberOfInstallments !== data.numberOfInstallments ||
      before.frequency !== data.frequency ||
      before.markupBps !== data.markupBps ||
      JSON.stringify(before.fees.map((f) => [f.name, f.amount])) !== JSON.stringify(data.fees.map((f) => [f.name, f.amount])) ||
      before.termsText !== data.termsText;
    if (contractChanged && before.termsVersion === data.termsVersion) {
      throw new AppError("VALIDATION", "You changed contract terms — bump the terms version.", {
        fieldErrors: { termsVersion: ["Use a new version when terms change"] },
      });
    }
    const plan = await PaymentPlan.findByIdAndUpdate(planId, { $set: data }, { returnDocument: "after", runValidators: true });
    await audit(actor, "plan.update", "PaymentPlan", planId, { metadata: { code: data.code, termsVersion: data.termsVersion, contractChanged } });
    return plan;
  } catch (err) {
    if (isDuplicateKeyError(err)) throw new AppError("CONFLICT", "That plan code is already used.", { fieldErrors: { code: ["Already in use"] } });
    throw err;
  }
}

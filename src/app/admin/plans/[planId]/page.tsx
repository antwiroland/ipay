import { Types } from "mongoose";
import { notFound } from "next/navigation";
import { PlanForm, type PlanFormValues } from "@/components/admin/plan-form";
import { PageHeader } from "@/components/ui/primitives";
import { pesewasToCedisString } from "@/lib/money";
import { PaymentPlan, type IPaymentPlan } from "@/models";
import { requireStaffPage } from "@/server/auth/session";

export const metadata = { title: "Installment plan" };

function toValues(p: IPaymentPlan | null): PlanFormValues {
  return {
    name: p?.name ?? "",
    code: p?.code ?? "",
    description: p?.description ?? "",
    purchaseModel: p?.purchaseModel ?? "take_and_pay",
    depositType: p?.depositType ?? "percentage",
    depositValue: p ? (p.depositType === "percentage" ? String(p.depositValue / 100) : pesewasToCedisString(p.depositValue)) : "40",
    frequency: p?.frequency ?? "weekly",
    numberOfInstallments: String(p?.numberOfInstallments ?? 12),
    markupPercent: String((p?.markupBps ?? 0) / 100),
    fees: p?.fees.map((f) => ({ name: f.name, amount: pesewasToCedisString(f.amount) })) ?? [],
    dueDayOfMonth: p?.dueDayOfMonth ? String(p.dueDayOfMonth) : "",
    gracePeriodDays: String(p?.gracePeriodDays ?? 3),
    latePaymentPolicy: p?.latePaymentPolicy ?? "No automatic late fees. After the grace period we will contact you to agree a plan.",
    requiresVerification: p?.eligibility.requiresVerification ?? true,
    requiresApproval: p?.eligibility.requiresApproval ?? true,
    minAccountAgeDays: String(p?.eligibility.minAccountAgeDays ?? 0),
    allowPartialPayments: p?.allowPartialPayments ?? true,
    allowAdditionalPayments: p?.allowAdditionalPayments ?? true,
    termsVersion: p?.termsVersion ?? "1.0",
    termsText: p?.termsText ?? "",
    isActive: p?.isActive ?? true,
    sortOrder: String(p?.sortOrder ?? 0),
  };
}

export default async function PlanPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  await requireStaffPage("plans.manage", `/admin/plans/${planId}`);
  const isNew = planId === "new";
  if (!isNew && !Types.ObjectId.isValid(planId)) notFound();
  const plan = isNew ? null : await PaymentPlan.findById(planId).lean();
  if (!isNew && !plan) notFound();
  return (
    <div>
      <PageHeader title={plan ? plan.name : "New installment plan"} description="The calculator shows the full financial breakdown customers will see before accepting." />
      <PlanForm planId={isNew ? null : planId} initial={toValues(plan)} />
    </div>
  );
}

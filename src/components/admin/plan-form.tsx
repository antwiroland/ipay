"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { savePlanAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardContent, CardHeader, CardTitle, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { cedisToPesewas, formatGHS } from "@/lib/money";
import { quote } from "@/lib/pricing";

export interface PlanFormValues {
  name: string;
  code: string;
  description: string;
  purchaseModel: "take_and_pay" | "pay_small_small";
  depositType: "percentage" | "fixed";
  depositValue: string;
  frequency: "weekly" | "monthly";
  numberOfInstallments: string;
  markupPercent: string;
  fees: { name: string; amount: string }[];
  dueDayOfMonth: string;
  gracePeriodDays: string;
  latePaymentPolicy: string;
  requiresVerification: boolean;
  requiresApproval: boolean;
  minAccountAgeDays: string;
  allowPartialPayments: boolean;
  allowAdditionalPayments: boolean;
  termsVersion: string;
  termsText: string;
  isActive: boolean;
  sortOrder: string;
}

export function PlanForm({ planId, initial }: { planId: string | null; initial: PlanFormValues }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [sample, setSample] = useState("6600");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof PlanFormValues>(k: K, val: PlanFormValues[K]) => setV((s) => ({ ...s, [k]: val }));

  let preview: ReturnType<typeof quote> | null = null;
  try {
    preview = quote(
      { cashPrice: 0, installmentPrice: cedisToPesewas(sample || "0") },
      {
        purchaseModel: v.purchaseModel,
        depositType: v.depositType,
        depositValue: v.depositType === "percentage" ? Math.round(Number(v.depositValue) * 100) : cedisToPesewas(v.depositValue || "0"),
        frequency: v.frequency,
        numberOfInstallments: Number(v.numberOfInstallments) || 1,
        markupBps: Math.round(Number(v.markupPercent || 0) * 100),
        fees: v.fees.filter((f) => f.amount).map((f) => ({ name: f.name, amount: cedisToPesewas(f.amount) })),
      },
    );
  } catch {
    preview = null;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        {error && <Alert tone="danger">{error}</Alert>}
        <Card>
          <CardHeader><CardTitle>Plan</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="pn" error={errors.name}><Input id="pn" value={v.name} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label="Code" htmlFor="pc" error={errors.code} hint="Unique, lowercase"><Input id="pc" value={v.code} onChange={(e) => set("code", e.target.value)} /></Field>
            <Field label="Purchase model" htmlFor="pm">
              <Select id="pm" value={v.purchaseModel} onChange={(e) => set("purchaseModel", e.target.value as never)}>
                <option value="take_and_pay">Take & Pay</option><option value="pay_small_small">Pay Small-Small</option>
              </Select>
            </Field>
            <Field label="Display order" htmlFor="so"><Input id="so" inputMode="numeric" value={v.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} /></Field>
            <Field label="Short description" htmlFor="pd" className="sm:col-span-2"><Input id="pd" value={v.description} onChange={(e) => set("description", e.target.value)} /></Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Deposit & schedule</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Field label="Deposit type" htmlFor="dt">
              <Select id="dt" value={v.depositType} onChange={(e) => set("depositType", e.target.value as never)}>
                <option value="percentage">Percentage</option><option value="fixed">Fixed amount</option>
              </Select>
            </Field>
            <Field label={v.depositType === "percentage" ? "Deposit (%)" : "Deposit (GH₵)"} htmlFor="dv" error={errors.depositValue}><Input id="dv" inputMode="decimal" value={v.depositValue} onChange={(e) => set("depositValue", e.target.value)} /></Field>
            <Field label="Frequency" htmlFor="fr">
              <Select id="fr" value={v.frequency} onChange={(e) => set("frequency", e.target.value as never)}>
                <option value="weekly">Weekly</option><option value="monthly">Monthly</option>
              </Select>
            </Field>
            <Field label="Number of installments" htmlFor="ni" error={errors.numberOfInstallments}><Input id="ni" inputMode="numeric" value={v.numberOfInstallments} onChange={(e) => set("numberOfInstallments", e.target.value)} /></Field>
            {v.frequency === "monthly" && (
              <Field label="Fixed due day (1–28)" htmlFor="dd" error={errors.dueDayOfMonth} hint="Blank = monthly anniversary"><Input id="dd" inputMode="numeric" value={v.dueDayOfMonth} onChange={(e) => set("dueDayOfMonth", e.target.value)} /></Field>
            )}
            <Field label="Grace period (days)" htmlFor="gp"><Input id="gp" inputMode="numeric" value={v.gracePeriodDays} onChange={(e) => set("gracePeriodDays", e.target.value)} /></Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Charges</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Field label="Financing charge (% of price)" htmlFor="mk" hint="Only where legally permitted. Disclosed to customers before they apply."><Input id="mk" inputMode="decimal" value={v.markupPercent} onChange={(e) => set("markupPercent", e.target.value)} className="sm:w-40" /></Field>
            {v.fees.map((f, i) => (
              <div key={i} className="grid grid-cols-[2fr_1fr_auto] gap-2">
                <Input aria-label="Fee name" placeholder="Admin fee" value={f.name} onChange={(e) => set("fees", v.fees.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <Input aria-label="Fee amount" placeholder="50" inputMode="decimal" value={f.amount} onChange={(e) => set("fees", v.fees.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
                <Button variant="ghost" size="icon" aria-label="Remove fee" onClick={() => set("fees", v.fees.filter((_, j) => j !== i))}><Trash2 /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => set("fees", [...v.fees, { name: "", amount: "" }])}><Plus /> Add disclosed fee</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Eligibility & payment rules</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            {(
              [
                ["requiresVerification", "Requires identity verification"],
                ["requiresApproval", "Requires staff approval"],
                ["allowPartialPayments", "Allow partial payments"],
                ["allowAdditionalPayments", "Allow additional / early payments"],
                ["isActive", "Plan is available"],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2.5">
                <input type="checkbox" className="size-4 accent-[var(--foreground)]" checked={v[k]} onChange={(e) => set(k, e.target.checked)} /> {label}
              </label>
            ))}
            <Field label="Minimum account age (days)" htmlFor="ma"><Input id="ma" inputMode="numeric" value={v.minAccountAgeDays} onChange={(e) => set("minAccountAgeDays", e.target.value)} /></Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Terms</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Field label="Terms version" htmlFor="tv" error={errors.termsVersion} hint="Bump whenever contract terms change. Existing orders keep the version they accepted."><Input id="tv" value={v.termsVersion} onChange={(e) => set("termsVersion", e.target.value)} className="sm:w-48" /></Field>
            <Field label="Late-payment policy" htmlFor="lp"><Textarea id="lp" value={v.latePaymentPolicy} onChange={(e) => set("latePaymentPolicy", e.target.value)} /></Field>
            <Field label="Agreement text" htmlFor="tt" error={errors.termsText}><Textarea id="tt" rows={10} value={v.termsText} onChange={(e) => set("termsText", e.target.value)} /></Field>
          </CardContent>
        </Card>
      </div>
      <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
        <Card>
          <CardHeader><CardTitle>Breakdown preview</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Field label="Sample installment price (GH₵)" htmlFor="smp"><Input id="smp" inputMode="decimal" value={sample} onChange={(e) => setSample(e.target.value)} /></Field>
            {preview ? (
              <dl className="space-y-1.5">
                {[
                  ["Installment price", formatGHS(preview.basePrice)],
                  ["Financing charge", formatGHS(preview.markup)],
                  ["Fees", formatGHS(preview.feesTotal)],
                  ["Total payable", formatGHS(preview.contractPrice)],
                  ["Deposit", formatGHS(preview.deposit)],
                  ["Remaining", formatGHS(preview.financed)],
                  [`${preview.numberOfInstallments} × ${v.frequency}`, formatGHS(preview.regularInstallment) + (preview.finalInstallment !== preview.regularInstallment ? ` (final ${formatGHS(preview.finalInstallment)})` : "")],
                ].map(([k, val]) => (
                  <div key={k} className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="tabular font-medium">{val}</dd></div>
                ))}
              </dl>
            ) : <p className="text-muted">Enter valid values to preview.</p>}
            <Button className="w-full" loading={pending} onClick={() => start(async () => {
              setError(null);
              const r = await savePlanAction(planId, { ...v, fees: v.fees.filter((f) => f.name || f.amount), dueDayOfMonth: v.frequency === "monthly" ? v.dueDayOfMonth : "" });
              if (r.ok) { toast.success(r.message ?? "Saved"); setErrors({}); if (!planId) router.push(`/admin/plans/${r.data.id}`); else router.refresh(); }
              else { setError(r.error); setErrors(r.fieldErrors ?? {}); }
            })}>Save plan</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

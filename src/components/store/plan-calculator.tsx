"use client";

import { AlertCircle, ArrowRight, Check, Info, Lock, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { applyForOrderAction } from "@/app/actions/orders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { Alert } from "@/components/ui/primitives";
import { formatGHS } from "@/lib/money";
import { frequencyLabel, PURCHASE_MODEL_LABEL, quote, scheduleDueDates, type PricingPlan, type PricingProduct } from "@/lib/pricing";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { useProductColour } from "./product-colour";

export interface CalcPlan extends PricingPlan {
  id: string;
  name: string;
  description: string;
  termsVersion: string;
  termsText: string;
  gracePeriodDays: number;
  latePaymentPolicy: string;
  allowPartialPayments: boolean;
  allowAdditionalPayments: boolean;
  requiresVerification: boolean;
  requiresApproval: boolean;
}

export type Viewer =
  | { kind: "guest" }
  | { kind: "staff" }
  | { kind: "customer"; activeOrderId: string | null; verificationStatus: string };

export function PlanCalculator({
  product,
  productId,
  slug,
  plans,
  colours,
  campaign,
  inStock,
  viewer,
}: {
  product: PricingProduct;
  productId: string;
  slug: string;
  plans: CalcPlan[];
  colours: { name: string; hex: string }[];
  campaign: { discountBps: number; title: string } | null;
  inStock: boolean;
  viewer: Viewer;
}) {
  const router = useRouter();
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [colour, setColour] = useProductColour(colours[0]?.name ?? "");
  const [addOns, setAddOns] = useState<string[]>([]);
  const [agree, setAgree] = useState(false);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const plan = plans.find((p) => p.id === planId);
  const q = useMemo(() => (plan ? quote(product, plan, { addOnKeys: addOns, campaign }) : null), [product, plan, addOns, campaign]);
  const preview = useMemo(() => (plan && q ? scheduleDueDates(new Date(), { ...plan, numberOfInstallments: q.numberOfInstallments }).slice(0, 3) : []), [plan, q]);

  const models = [...new Set(plans.map((p) => p.purchaseModel))];

  const submit = () => {
    if (!plan) return;
    setError(null);
    start(async () => {
      const r = await applyForOrderAction({ productId, planId: plan.id, colour, addOnKeys: addOns, acceptTerms: agree, termsVersion: plan.termsVersion });
      if (r.ok) {
        toast.success("Application submitted");
        router.push(r.data.redirectTo);
      } else {
        setError(r.error);
        if (r.code === "ACTIVE_ORDER_EXISTS") router.refresh();
      }
    });
  };

  if (!plans.length || !q || !plan) {
    return <Alert tone="info" title="Installment plans are not available for this device right now." />;
  }

  let cta: React.ReactNode;
  if (!inStock) {
    cta = <Button size="lg" className="w-full" disabled>Out of stock</Button>;
  } else if (viewer.kind === "guest") {
    cta = (
      <div className="space-y-2">
        <Button size="lg" className="w-full" asChild>
          <Link href={`/login?next=${encodeURIComponent(`/products/${slug}#plans`)}`}>
            Log in to apply <ArrowRight />
          </Link>
        </Button>
        <p className="text-center text-[13px] text-muted">
          New here? <Link className="font-medium text-accent hover:underline" href={`/register?next=${encodeURIComponent(`/products/${slug}#plans`)}`}>Create an account</Link> — it takes a minute.
        </p>
      </div>
    );
  } else if (viewer.kind === "staff") {
    cta = <Alert tone="info" title="Staff accounts cannot place orders." />;
  } else if (viewer.activeOrderId) {
    cta = (
      <div className="space-y-3">
        <Alert tone="warning" icon={<Lock />} title="You already have an active plan">
          You currently have an active installment plan. Complete your outstanding balance before applying for another device.
        </Alert>
        <Button variant="outline" className="w-full" asChild>
          <Link href={`/account/orders/${viewer.activeOrderId}`}>View my active plan</Link>
        </Button>
      </div>
    );
  } else if (plan.requiresVerification && !["pending", "verified"].includes(viewer.verificationStatus)) {
    cta = (
      <div className="space-y-3">
        <Alert tone="info" icon={<ShieldCheck />} title="Verify your identity to choose this plan">
          {PURCHASE_MODEL_LABEL[plan.purchaseModel]} plans need identity verification. It only takes a minute to submit your details.
        </Alert>
        <Button className="w-full" asChild>
          <Link href={`/account/profile?verify=1&next=${encodeURIComponent(`/products/${slug}#plans`)}`}>Verify my identity</Link>
        </Button>
      </div>
    );
  } else {
    cta = (
      <Button size="lg" className="w-full" onClick={() => setOpen(true)}>
        Buy on installments <ArrowRight />
      </Button>
    );
  }

  return (
    <div id="plans" className="scroll-mt-24 rounded-[20px] border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight">Choose your plan</h2>

      {colours.length > 0 && (
        <fieldset className="mt-5">
          <legend className="text-[13px] font-medium">Colour · <span className="text-muted">{colour}</span></legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {colours.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setColour(c.name)}
                aria-pressed={colour === c.name}
                aria-label={c.name}
                title={c.name}
                className={cn("size-9 rounded-full border-2 transition", colour === c.name ? "border-foreground" : "border-transparent ring-1 ring-border hover:ring-border-strong")}
              >
                <span className="block size-full rounded-full border-2 border-surface" style={{ background: c.hex }} />
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {models.map((m) => (
        <fieldset key={m} className="mt-5">
          <legend className="text-[13px] font-medium">{PURCHASE_MODEL_LABEL[m]}</legend>
          <div className="mt-2 grid gap-2">
            {plans
              .filter((p) => p.purchaseModel === m)
              .map((p) => {
                const pq = quote(product, p, { addOnKeys: addOns, campaign });
                return (
                  <label
                    key={p.id}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-3 rounded-[14px] border p-3.5 transition",
                      planId === p.id ? "border-foreground bg-surface-2/60 ring-1 ring-foreground" : "border-border hover:border-border-strong",
                    )}
                  >
                    <input type="radio" name="plan" value={p.id} checked={planId === p.id} onChange={() => setPlanId(p.id)} className="sr-only" />
                    <div>
                      <p className="text-sm font-semibold">{p.name}</p>
                      <p className="text-[12.5px] text-muted">{p.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="tabular text-sm font-semibold">{formatGHS(pq.regularInstallment)}<span className="font-normal text-muted">/{p.frequency === "weekly" ? "wk" : "mo"}</span></p>
                      <p className="tabular text-[12px] text-muted">{formatGHS(pq.deposit)} deposit</p>
                    </div>
                  </label>
                );
              })}
          </div>
        </fieldset>
      ))}

      {(product.addOns?.length ?? 0) > 0 && (
        <fieldset className="mt-5">
          <legend className="text-[13px] font-medium">Add-ons <span className="text-muted">(optional, included in your plan)</span></legend>
          <div className="mt-2 space-y-2">
            {product.addOns!.map((a) => (
              <label key={a.key} className="flex cursor-pointer items-center justify-between gap-3 rounded-[12px] border border-border px-3.5 py-2.5 text-sm hover:border-border-strong">
                <span className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--foreground)]"
                    checked={addOns.includes(a.key)}
                    onChange={(e) => setAddOns((x) => (e.target.checked ? [...x, a.key] : x.filter((k) => k !== a.key)))}
                  />
                  {a.name}
                </span>
                <span className="tabular text-muted">+{formatGHS(a.price)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {/* Breakdown */}
      <div className="mt-6 rounded-[16px] bg-surface-2/70 p-4" aria-live="polite">
        <dl className="space-y-2 text-[14px]">
          <Row k="Cash price (pay in full)" v={formatGHS(q.cashPrice)} muted />
          <Row k={q.promoApplied ? "Installment price (offer)" : "Installment price"} v={formatGHS(q.basePrice)} />
          {q.addOnsTotal > 0 && <Row k="Add-ons" v={formatGHS(q.addOnsTotal)} />}
          {q.markup > 0 && <Row k={`Financing charge (${(plan.markupBps / 100).toFixed(1)}%)`} v={formatGHS(q.markup)} />}
          {q.fees.map((f) => (
            <Row key={f.name} k={f.name} v={formatGHS(f.amount)} />
          ))}
          <div className="my-2 border-t border-border" />
          <Row k="Total amount payable" v={formatGHS(q.contractPrice)} strong />
          <Row k={plan.depositType === "percentage" ? `Deposit (${plan.depositValue / 100}%)` : "Deposit"} v={formatGHS(q.deposit)} />
          <Row k="Remaining balance" v={formatGHS(q.financed)} />
          <Row
            k={`${q.numberOfInstallments} ${plan.frequency} installments`}
            v={q.finalInstallment !== q.regularInstallment ? `${formatGHS(q.regularInstallment)} (final ${formatGHS(q.finalInstallment)})` : formatGHS(q.regularInstallment)}
            strong
          />
          <Row k="Repayment duration" v={frequencyLabel(plan.frequency, q.numberOfInstallments)} muted />
        </dl>
        {campaign && <Badge tone="accent" className="mt-3">{campaign.title}</Badge>}
      </div>

      <div className="mt-5">{cta}</div>
      {error && (
        <Alert tone="danger" className="mt-3" icon={<AlertCircle />}>
          {error}
        </Alert>
      )}

      <ul className="mt-5 space-y-1.5 text-[12.5px] text-muted">
        <li className="flex gap-2"><Check className="size-3.5 shrink-0 translate-y-0.5 text-success" /> Payments settle your oldest installment first</li>
        <li className="flex gap-2"><Check className="size-3.5 shrink-0 translate-y-0.5 text-success" /> {plan.allowAdditionalPayments ? "Pay early or pay extra any time" : "Fixed installment amounts"}</li>
        <li className="flex gap-2"><Check className="size-3.5 shrink-0 translate-y-0.5 text-success" /> {plan.gracePeriodDays}-day grace period · no automatic late fees</li>
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Review your installment agreement" description={`${plan.name} · ${colour}`} className="max-w-xl">
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Mini k="Total payable" v={formatGHS(q.contractPrice)} />
              <Mini k="Deposit due" v={formatGHS(q.deposit)} />
              <Mini k={`${q.numberOfInstallments} × ${plan.frequency}`} v={formatGHS(q.regularInstallment)} />
              <Mini k="First due (est.)" v={preview[0] ? formatDate(preview[0]) : "—"} />
            </div>
            <Alert tone="info" icon={<Info />}>
              {plan.requiresApproval ? "Your application will be reviewed (usually within one business day). " : ""}
              Your schedule starts when your deposit is confirmed. {plan.purchaseModel === "pay_small_small" ? "We'll keep your iPhone safe until it's fully paid." : "Collect your iPhone after approval and deposit."}
            </Alert>
            <div className="max-h-48 overflow-y-auto rounded-[12px] border border-border bg-surface-2/50 p-3 text-[12.5px] leading-relaxed whitespace-pre-line text-muted">
              {plan.termsText}
              {plan.latePaymentPolicy && `\n\nLate payments: ${plan.latePaymentPolicy}`}
            </div>
            <label className="flex items-start gap-2.5">
              <input type="checkbox" className="mt-0.5 size-4 accent-[var(--foreground)]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span>I have read and agree to the installment agreement (version {plan.termsVersion}), including the total amount payable of <strong className="tabular">{formatGHS(q.contractPrice)}</strong>.</span>
            </label>
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setOpen(false)}>Back</Button>
              <Button onClick={submit} loading={pending} disabled={!agree}>Submit application</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ k, v, strong, muted }: { k: string; v: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={cn(muted ? "text-muted" : "text-foreground/80", strong && "font-semibold text-foreground")}>{k}</dt>
      <dd className={cn("tabular text-right", strong ? "font-semibold" : "", muted && "text-muted")}>{v}</dd>
    </div>
  );
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-[12px] border border-border p-3">
      <p className="text-[12px] text-muted">{k}</p>
      <p className="tabular mt-0.5 font-semibold">{v}</p>
    </div>
  );
}

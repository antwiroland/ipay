"use client";

import { CreditCard, Smartphone } from "lucide-react";
import { useState, useTransition } from "react";
import { startPaymentAction } from "@/app/actions/orders";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input } from "@/components/ui/primitives";
import { formatDate } from "@/lib/dates";
import { formatGHS } from "@/lib/money";
import { cn } from "@/lib/utils";

export interface PayPanelOptions {
  canPay: boolean;
  reason?: string;
  depositDue: number;
  nextInstallment: { number: number; amount: number; dueDate: string } | null;
  outstanding: number;
  allowPartial: boolean;
  allowAdditional: boolean;
}

type Kind = "deposit" | "installment" | "full_balance" | "additional";

export function PayPanel({ orderId, options, depositPaid, sandbox }: { orderId: string; options: PayPanelOptions; depositPaid: boolean; sandbox: boolean }) {
  const [kind, setKind] = useState<Kind>(depositPaid ? "installment" : "deposit");
  const [amount, setAmount] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!options.canPay) return options.reason ? <Alert tone="info">{options.reason}</Alert> : null;

  const choices: { k: Kind; label: string; amount: number | null; hint: string }[] = depositPaid
    ? [
        ...(options.nextInstallment
          ? [{ k: "installment" as Kind, label: `Installment ${options.nextInstallment.number}`, amount: options.nextInstallment.amount, hint: `Due ${formatDate(options.nextInstallment.dueDate)}` }]
          : []),
        { k: "full_balance", label: "Pay off full balance", amount: options.outstanding, hint: "Finish your plan today" },
        ...(options.allowAdditional || options.allowPartial ? [{ k: "additional" as Kind, label: "Another amount", amount: null, hint: options.allowPartial ? "Any amount up to your balance" : "More than your next installment" }] : []),
      ]
    : [{ k: "deposit", label: "Deposit", amount: options.depositDue, hint: "Starts your plan" }];

  const pay = () =>
    start(async () => {
      setError(null);
      const r = await startPaymentAction({ orderId, kind, amount: kind === "additional" ? amount : undefined });
      if (r.ok) window.location.assign(r.data.checkoutUrl);
      else setError(r.error);
    });

  return (
    <div className="rounded-[20px] border border-border bg-surface p-5 sm:p-6" id="pay">
      <h2 className="font-semibold">Make a payment</h2>
      <div className="mt-4 grid gap-2" role="radiogroup" aria-label="What would you like to pay?">
        {choices.map((c) => (
          <button
            key={c.k}
            type="button"
            role="radio"
            aria-checked={kind === c.k}
            onClick={() => setKind(c.k)}
            className={cn(
              "flex items-center justify-between gap-3 rounded-[14px] border p-3.5 text-left transition",
              kind === c.k ? "border-foreground ring-1 ring-foreground" : "border-border hover:border-border-strong",
            )}
          >
            <span>
              <span className="block text-sm font-medium">{c.label}</span>
              <span className="block text-[12.5px] text-muted">{c.hint}</span>
            </span>
            {c.amount != null && <span className="tabular text-sm font-semibold">{formatGHS(c.amount)}</span>}
          </button>
        ))}
      </div>
      {kind === "additional" && (
        <Field label="Amount (GH₵)" htmlFor="pay-amount" className="mt-4" hint={`Up to ${formatGHS(options.outstanding)}`}>
          <Input id="pay-amount" inputMode="decimal" placeholder="e.g. 500" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
      )}
      {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
      <Button size="lg" className="mt-5 w-full" onClick={pay} loading={pending} disabled={kind === "additional" && !amount}>
        Continue to secure payment
      </Button>
      <p className="mt-3 flex items-center justify-center gap-3 text-[12px] text-muted">
        <span className="flex items-center gap-1"><Smartphone className="size-3.5" /> Mobile Money</span>
        <span className="flex items-center gap-1"><CreditCard className="size-3.5" /> Card</span>
        {sandbox && <span className="font-semibold text-warning">· Sandbox</span>}
      </p>
      <p className="mt-2 text-center text-[11.5px] text-subtle">Your balance updates only after the payment provider confirms the payment.</p>
    </div>
  );
}

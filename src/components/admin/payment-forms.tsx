"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { manualPaymentAction, refundAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/overlays";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { formatGHS } from "@/lib/money";

export function ManualPaymentDialog({ orderId, max }: { orderId: string; max: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ amount: "", method: "cash", externalReference: "", reason: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm">Record manual payment</Button></DialogTrigger>
      <DialogContent title="Record a manual payment" description="Use only for money received outside the payment provider (e.g. cash at the store). This is an audited financial correction.">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Amount (GH₵)" htmlFor="mp-amt" hint={`Max ${formatGHS(max)}`}><Input id="mp-amt" inputMode="decimal" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} /></Field>
            <Field label="Method" htmlFor="mp-m">
              <Select id="mp-m" value={v.method} onChange={(e) => setV({ ...v, method: e.target.value })}>
                <option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="mobile_money">Mobile Money (direct)</option><option value="cheque">Cheque</option>
              </Select>
            </Field>
          </div>
          <Field label="External reference (optional)" htmlFor="mp-ref"><Input id="mp-ref" value={v.externalReference} onChange={(e) => setV({ ...v, externalReference: e.target.value })} /></Field>
          <Field label="Reason & evidence" htmlFor="mp-r" hint="e.g. receipt number, who received it"><Textarea id="mp-r" value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} /></Field>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={pending} onClick={() => start(async () => {
              const r = await manualPaymentAction({ orderId, ...v, externalReference: v.externalReference || undefined });
              if (r.ok) { toast.success(r.message ?? "Recorded"); setOpen(false); router.refresh(); } else setError(r.error);
            })}>Record payment</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RefundDialog({ paymentId, refundable }: { paymentId: string; refundable: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ amount: "", type: "refund", reason: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm">Refund / reversal</Button></DialogTrigger>
      <DialogContent title="Refund or reversal" description="Refunds are sent to the customer through the provider. Reversals record a chargeback/reversal the provider already made. Both are audited.">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Amount (GH₵)" htmlFor="rf-amt" hint={`Up to ${formatGHS(refundable)}`}><Input id="rf-amt" inputMode="decimal" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} /></Field>
            <Field label="Type" htmlFor="rf-t">
              <Select id="rf-t" value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })}>
                <option value="refund">Refund (send money back)</option><option value="reversal">Reversal (record provider reversal)</option>
              </Select>
            </Field>
          </div>
          <Field label="Reason" htmlFor="rf-r"><Textarea id="rf-r" value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} /></Field>
          <Alert tone="warning">Any unallocated excess is returned first. The rest is taken back from the order balance, newest installment first.</Alert>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="danger" loading={pending} onClick={() => start(async () => {
              const r = await refundAction({ paymentId, ...v });
              if (r.ok) { toast.success(r.message ?? "Done"); setOpen(false); router.refresh(); } else setError(r.error);
            })}>Confirm {v.type}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

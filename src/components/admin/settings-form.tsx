"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveSettingsAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, Field, Input, Select, Textarea } from "@/components/ui/primitives";

export type SettingsValues = {
  productsMenuLabel: string;
  takeAndPayEnabled: boolean;
  paySmallSmallEnabled: boolean;
  takeAndPaySummary: string;
  paySmallSmallSummary: string;
  reminderDaysBefore: number;
  pendingPaymentTtlMinutes: number;
  requireStaffMfa: boolean;
  supportPhone: string;
  supportWhatsapp: string;
  supportEmail: string;
  storeAddress: string;
};

export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const set = <K extends keyof SettingsValues>(k: K, val: SettingsValues[K]) => setV((s) => ({ ...s, [k]: val }));
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Purchase models</CardTitle></CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="flex items-center gap-2.5 text-sm font-medium"><input type="checkbox" className="size-4" checked={v.takeAndPayEnabled} onChange={(e) => set("takeAndPayEnabled", e.target.checked)} /> Take & Pay available</label>
            <Textarea aria-label="Take & Pay summary" value={v.takeAndPaySummary} onChange={(e) => set("takeAndPaySummary", e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2.5 text-sm font-medium"><input type="checkbox" className="size-4" checked={v.paySmallSmallEnabled} onChange={(e) => set("paySmallSmallEnabled", e.target.checked)} /> Pay Small-Small available</label>
            <Textarea aria-label="Pay Small-Small summary" value={v.paySmallSmallSummary} onChange={(e) => set("paySmallSmallSummary", e.target.value)} />
          </div>
          <p className="text-[12.5px] text-muted md:col-span-2">Turning a model off hides its plans from the storefront. Existing contracts are unaffected. Plan-level terms are edited under Installment Plans.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Operations</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Products menu label" htmlFor="pml">
            <Select id="pml" value={v.productsMenuLabel} onChange={(e) => set("productsMenuLabel", e.target.value)}>
              <option>Products & Offers</option><option>Projects</option>
            </Select>
          </Field>
          <Field label="Reminder days before due" htmlFor="rd"><Input id="rd" type="number" min={0} max={14} value={v.reminderDaysBefore} onChange={(e) => set("reminderDaysBefore", Number(e.target.value))} /></Field>
          <Field label="Checkout expiry (minutes)" htmlFor="ttl"><Input id="ttl" type="number" min={10} max={1440} value={v.pendingPaymentTtlMinutes} onChange={(e) => set("pendingPaymentTtlMinutes", Number(e.target.value))} /></Field>
          <label className="flex items-center gap-2.5 text-sm sm:col-span-3"><input type="checkbox" className="size-4" checked={v.requireStaffMfa} onChange={(e) => set("requireStaffMfa", e.target.checked)} /> Require two-factor authentication for all staff</label>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Support contact (shown on the storefront)</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" htmlFor="sph"><Input id="sph" value={v.supportPhone} onChange={(e) => set("supportPhone", e.target.value)} /></Field>
          <Field label="WhatsApp" htmlFor="swa"><Input id="swa" value={v.supportWhatsapp} onChange={(e) => set("supportWhatsapp", e.target.value)} /></Field>
          <Field label="Email" htmlFor="sem"><Input id="sem" value={v.supportEmail} onChange={(e) => set("supportEmail", e.target.value)} /></Field>
          <Field label="Store address" htmlFor="sad"><Input id="sad" value={v.storeAddress} onChange={(e) => set("storeAddress", e.target.value)} /></Field>
        </CardContent>
      </Card>
      <Button loading={pending} onClick={() => start(async () => {
        const r = await saveSettingsAction(v);
        if (r.ok) { toast.success(r.message ?? "Saved"); router.refresh(); } else toast.error(r.error);
      })}>Save settings</Button>
    </div>
  );
}

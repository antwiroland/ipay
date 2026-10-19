"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveTemplateAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/primitives";
import type { NotificationTemplateKey } from "@/models/Notification";

export function TemplateEditor({ k, initial }: { k: NotificationTemplateKey; initial: { subject: string; body: string; smsBody: string; enabled: boolean } }) {
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <details className="rounded-[12px] border border-border bg-surface p-4">
      <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium">
        <span className="font-mono text-[12.5px]">{k}</span>
        <span className={`text-[12px] ${v.enabled ? "text-success" : "text-subtle"}`}>{v.enabled ? "Enabled" : "Disabled"}</span>
      </summary>
      <div className="mt-4 space-y-3">
        <Field label="Subject" htmlFor={`${k}-s`}><Input id={`${k}-s`} value={v.subject} onChange={(e) => setV({ ...v, subject: e.target.value })} /></Field>
        <Field label="Email / in-app body" htmlFor={`${k}-b`} hint="Placeholders like {{name}}, {{amount}}, {{orderNumber}} are filled automatically."><Textarea id={`${k}-b`} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} /></Field>
        <Field label={`SMS (${v.smsBody.length}/480)`} htmlFor={`${k}-m`}><Textarea id={`${k}-m`} value={v.smsBody} maxLength={480} onChange={(e) => setV({ ...v, smsBody: e.target.value })} /></Field>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={v.enabled} onChange={(e) => setV({ ...v, enabled: e.target.checked })} /> Enabled</label>
          <Button size="sm" loading={pending} onClick={() => start(async () => {
            const r = await saveTemplateAction(k, v);
            if (r.ok) toast.success("Template saved"); else toast.error(r.error);
          })}>Save template</Button>
        </div>
      </div>
    </details>
  );
}

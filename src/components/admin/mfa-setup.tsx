"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { beginMfaAction, confirmMfaAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input } from "@/components/ui/primitives";

export function MfaSetup() {
  const router = useRouter();
  const [secret, setSecret] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!secret)
    return (
      <Button loading={pending} onClick={() => start(async () => {
        const r = await beginMfaAction();
        if (r.ok) setSecret(r.data); else setError(r.error);
      })}>Set up two-factor authentication</Button>
    );
  return (
    <div className="space-y-4">
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…).</li>
        <li>Add an account using this setup key: <span className="rounded bg-surface-2 px-2 py-1 font-mono text-[13px] select-all">{secret.secret.match(/.{1,4}/g)?.join(" ")}</span></li>
        <li>Enter the 6-digit code it shows.</li>
      </ol>
      <p className="text-[12px] break-all text-muted">Or open: <a className="text-accent" href={secret.uri}>{secret.uri}</a></p>
      <Field label="Code" htmlFor="mfa-c"><Input id="mfa-c" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="tabular w-40 tracking-[0.3em]" /></Field>
      {error && <Alert tone="danger">{error}</Alert>}
      <Button loading={pending} disabled={code.length !== 6} onClick={() => start(async () => {
        const r = await confirmMfaAction(code);
        if (r.ok) { toast.success(r.message ?? "Enabled"); router.push("/admin"); router.refresh(); } else setError(r.error);
      })}>Verify and enable</Button>
    </div>
  );
}

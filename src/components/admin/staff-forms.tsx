"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { changeRoleAction, createStaffAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/overlays";
import { Alert, Field, Input, Select } from "@/components/ui/primitives";
import { ROLE_LABEL, STAFF_ROLES, type Role } from "@/lib/permissions";

export function CreateStaffDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ name: "", email: "", phone: "", role: "support" });
  const [result, setResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setResult(null); setError(null); } }}>
      <DialogTrigger asChild><Button>Add staff member</Button></DialogTrigger>
      <DialogContent title="Add staff member" description="A one-time temporary password is shown once. Share it securely and ask them to change it and enable 2FA.">
        {result ? (
          <div className="space-y-3">
            <Alert tone="success" title="Account created">Temporary password for {result.email}:</Alert>
            <p className="rounded-lg bg-surface-2 p-3 text-center font-mono text-lg select-all">{result.tempPassword}</p>
            <Button className="w-full" onClick={() => setOpen(false)}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Full name" htmlFor="sf-n"><Input id="sf-n" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Email" htmlFor="sf-e"><Input id="sf-e" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
              <Field label="Phone" htmlFor="sf-p"><Input id="sf-p" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
            </div>
            <Field label="Role" htmlFor="sf-r">
              <Select id="sf-r" value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })}>
                {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </Select>
            </Field>
            {error && <Alert tone="danger">{error}</Alert>}
            <Button className="w-full" loading={pending} onClick={() => start(async () => {
              const r = await createStaffAction(v);
              if (r.ok) { setResult(r.data); router.refresh(); } else setError(r.error);
            })}>Create account</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function RoleSelect({ userId, role, disabled }: { userId: string; role: Role; disabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState<Role>(role);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <Select aria-label="Role" value={role} disabled={disabled} onChange={(e) => { setNext(e.target.value as Role); setOpen(true); }} className="w-44">
        {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
      </Select>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={`Change role to ${ROLE_LABEL[next]}?`} description="The user will be signed out. This change is recorded in the audit log.">
          <div className="space-y-3">
            <Field label="Reason" htmlFor="rc-r"><Input id="rc-r" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button loading={pending} disabled={reason.trim().length < 5} onClick={() => start(async () => {
                const r = await changeRoleAction(userId, next, reason);
                if (r.ok) { toast.success(r.message ?? "Updated"); setOpen(false); router.refresh(); } else setError(r.error);
              })}>Change role</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { changePasswordAction, submitVerificationAction, updateProfileAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input, Select } from "@/components/ui/primitives";

export function ProfileForm({ initial }: { initial: { name: string; phone: string; email: string; emailNotifications: boolean; smsNotifications: boolean; marketing: boolean } }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pw, setPw] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const phoneChanged = v.phone.replace(/\s/g, "") !== initial.phone;
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const { email: _email, ...rest } = v;
          void _email;
          const r = await updateProfileAction(rest, pw || undefined);
          if (r.ok) {
            toast.success(r.message ?? "Saved");
            setErrors({});
            setError(null);
            setPw("");
            router.refresh();
          } else {
            setError(r.error);
            setErrors(r.fieldErrors ?? {});
          }
        });
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="p-name" error={errors.name}>
          <Input id="p-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </Field>
        <Field label="Email" htmlFor="p-email" hint="Contact support to change your email">
          <Input id="p-email" value={v.email} disabled />
        </Field>
        <Field label="Phone" htmlFor="p-phone" error={errors.phone}>
          <Input id="p-phone" type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
        </Field>
        {phoneChanged && (
          <Field label="Current password" htmlFor="p-pw" error={errors.currentPassword} hint="Required to change your phone number">
            <Input id="p-pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
        )}
      </div>
      <fieldset className="space-y-2.5 rounded-[14px] border border-border p-4">
        <legend className="px-1 text-[13px] font-medium">Notifications & consent</legend>
        {(
          [
            ["emailNotifications", "Email me payment confirmations and reminders"],
            ["smsNotifications", "SMS me payment confirmations and reminders"],
            ["marketing", "Send me promotions and new arrivals (optional)"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--foreground)]" checked={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.checked })} />
            {label}
          </label>
        ))}
        <p className="text-[12px] text-muted">Security messages (like password resets) are always sent by email.</p>
      </fieldset>
      <Button type="submit" loading={pending}>Save changes</Button>
    </form>
  );
}

export function PasswordForm() {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (next !== confirm) return setError("New passwords do not match.");
        start(async () => {
          const r = await changePasswordAction(cur, next);
          if (r.ok) {
            toast.success(r.message ?? "Password changed");
            setCur("");
            setNext("");
            setConfirm("");
            setError(null);
          } else setError(r.fieldErrors?.currentPassword?.[0] ?? r.error);
        });
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Current password" htmlFor="cp"><Input id="cp" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required /></Field>
        <Field label="New password" htmlFor="np" hint="10+ characters, letter and number"><Input id="np" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required /></Field>
        <Field label="Confirm new password" htmlFor="np2"><Input id="np2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></Field>
      </div>
      <Button type="submit" variant="outline" loading={pending}>Change password</Button>
    </form>
  );
}

export function VerificationForm({ next }: { next?: string }) {
  const router = useRouter();
  const [v, setV] = useState({ documentType: "ghana_card", idNumber: "", dateOfBirth: "", consent: false });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await submitVerificationAction(v);
          if (r.ok) {
            toast.success(r.message ?? "Submitted");
            if (next) router.push(next);
            else router.refresh();
          } else {
            setError(r.error);
            setErrors(r.fieldErrors ?? {});
          }
        });
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="ID type" htmlFor="v-type">
          <Select id="v-type" value={v.documentType} onChange={(e) => setV({ ...v, documentType: e.target.value })}>
            <option value="ghana_card">Ghana Card</option>
            <option value="passport">Passport</option>
            <option value="drivers_licence">Driver&apos;s licence</option>
            <option value="voter_id">Voter ID</option>
          </Select>
        </Field>
        <Field label="ID number" htmlFor="v-id" error={errors.idNumber} hint={v.documentType === "ghana_card" ? "e.g. GHA-123456789-0" : undefined}>
          <Input id="v-id" value={v.idNumber} onChange={(e) => setV({ ...v, idNumber: e.target.value })} autoComplete="off" />
        </Field>
        <Field label="Date of birth" htmlFor="v-dob" error={errors.dateOfBirth}>
          <Input id="v-dob" type="date" value={v.dateOfBirth} onChange={(e) => setV({ ...v, dateOfBirth: e.target.value })} />
        </Field>
      </div>
      <label className="flex items-start gap-2.5 text-[13.5px]">
        <input type="checkbox" className="mt-0.5 size-4 accent-[var(--foreground)]" checked={v.consent} onChange={(e) => setV({ ...v, consent: e.target.checked })} />
        I consent to iPay Ghana verifying my identity for this installment purchase. I understand my original ID will be checked by staff before approval.
      </label>
      {errors.consent && <p className="text-[12.5px] text-danger">{errors.consent[0]}</p>}
      <Button type="submit" loading={pending}>Submit for verification</Button>
    </form>
  );
}

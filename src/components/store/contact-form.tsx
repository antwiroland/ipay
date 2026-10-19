"use client";

import { CheckCircle2 } from "lucide-react";
import { useState, useTransition } from "react";
import { contactAction } from "@/app/actions/public";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input, Textarea } from "@/components/ui/primitives";

export function ContactForm() {
  const [v, setV] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (done) return <Alert tone="success" icon={<CheckCircle2 />} title="Message sent">{done}</Alert>;
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await contactAction(v);
          if (r.ok) setDone(r.message ?? "Thanks!");
          else {
            setError(r.error);
            setErrors(r.fieldErrors ?? {});
          }
        });
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="c-name" error={errors.name}><Input id="c-name" value={v.name} onChange={set("name")} required autoComplete="name" /></Field>
        <Field label="Email" htmlFor="c-email" error={errors.email}><Input id="c-email" type="email" value={v.email} onChange={set("email")} required autoComplete="email" /></Field>
        <Field label="Phone (optional)" htmlFor="c-phone"><Input id="c-phone" type="tel" value={v.phone} onChange={set("phone")} autoComplete="tel" /></Field>
        <Field label="Subject" htmlFor="c-subject" error={errors.subject}><Input id="c-subject" value={v.subject} onChange={set("subject")} required /></Field>
      </div>
      <Field label="Message" htmlFor="c-message" error={errors.message}>
        <Textarea id="c-message" rows={6} value={v.message} onChange={set("message")} required />
      </Field>
      <p className="text-[12.5px] text-muted">Please don&apos;t include card numbers, PINs or passwords. We will never ask for them.</p>
      <Button type="submit" size="lg" loading={pending}>Send message</Button>
    </form>
  );
}

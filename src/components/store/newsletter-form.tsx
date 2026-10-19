"use client";

import { useActionState } from "react";
import { subscribeAction } from "@/app/actions/public";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";

export function NewsletterForm() {
  const [state, action, pending] = useActionState(subscribeAction, null);
  if (state?.ok) return <p className="mt-4 rounded-lg bg-success-soft p-3 text-sm text-success">You&apos;re subscribed. Thank you!</p>;
  return (
    <form action={action} className="mt-4 space-y-2">
      <div className="flex gap-2">
        <label htmlFor="newsletter-email" className="sr-only">Email address</label>
        <Input id="newsletter-email" name="email" type="email" required placeholder="you@example.com" autoComplete="email" />
        <Button type="submit" loading={pending}>Join</Button>
      </div>
      <label className="flex items-start gap-2 text-[12.5px] text-muted">
        <input type="checkbox" name="consent" required className="mt-0.5 accent-[var(--accent)]" />
        I agree to receive promotional emails from iPay Ghana.
      </label>
      {state && !state.ok && <p className="text-[12.5px] text-danger">{state.error}</p>}
    </form>
  );
}

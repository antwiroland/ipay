"use client";

import { Star } from "lucide-react";
import { useState, useTransition } from "react";
import { submitReviewAction } from "@/app/actions/orders";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input, Textarea } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function ReviewForm({ orderId, defaultName }: { orderId: string; defaultName: string }) {
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [name, setName] = useState(defaultName);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (msg?.ok) return <Alert tone="success">{msg.text}</Alert>;
  return (
    <div className="space-y-3">
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} stars`} onClick={() => setRating(n)}>
            <Star className={cn("size-6", n <= rating ? "fill-accent text-accent" : "text-border-strong")} />
          </button>
        ))}
      </div>
      <Field label="Name to display" htmlFor="rv-n"><Input id="rv-n" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Your review" htmlFor="rv-b"><Textarea id="rv-b" value={body} onChange={(e) => setBody(e.target.value)} maxLength={600} /></Field>
      {msg && !msg.ok && <Alert tone="danger">{msg.text}</Alert>}
      <Button loading={pending} onClick={() => start(async () => {
        const r = await submitReviewAction(orderId, { rating, body, displayName: name });
        setMsg(r.ok ? { ok: true, text: r.message ?? "Thanks!" } : { ok: false, text: r.error });
      })}>Submit review</Button>
    </div>
  );
}

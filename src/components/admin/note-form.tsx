"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { customerNoteAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/primitives";

export function NoteForm({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await customerNoteAction(customerId, body);
          if (r.ok) {
            setBody("");
            router.refresh();
          }
        });
      }}
    >
      <label htmlFor="note" className="sr-only">Internal note</label>
      <Textarea id="note" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add an internal note (not visible to the customer)" />
      <Button type="submit" size="sm" loading={pending} disabled={body.trim().length < 2}>Add note</Button>
    </form>
  );
}

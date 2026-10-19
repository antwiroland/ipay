"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { Alert, Field, Textarea } from "@/components/ui/primitives";
import type { ActionResult } from "@/server/errors";

/**
 * Button for a (bound) server action. Optionally asks for confirmation and/or a reason,
 * which is appended as the action's last argument.
 */
export function ActionButton({
  action,
  label,
  confirm,
  reason,
  reasonLabel = "Reason",
  variant = "outline",
  size = "sm",
  danger,
}: {
  action: (note: string) => Promise<ActionResult<unknown>>;
  label: string;
  confirm?: { title: string; description?: string; cta?: string };
  reason?: "required" | "optional";
  reasonLabel?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  danger?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const exec = () =>
    start(async () => {
      setError(null);
      const r = await action(note);
      if (r.ok) {
        toast.success(r.message ?? "Done");
        setOpen(false);
        setNote("");
        router.refresh();
      } else {
        if (open) setError(r.error);
        else toast.error(r.error);
      }
    });

  if (!confirm && !reason) {
    return (
      <Button variant={danger ? "danger" : variant} size={size} loading={pending} onClick={exec}>
        {label}
      </Button>
    );
  }
  return (
    <>
      <Button variant={danger ? "danger" : variant} size={size} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={confirm?.title ?? label} description={confirm?.description}>
          <div className="space-y-4">
            {reason && (
              <Field label={`${reasonLabel}${reason === "optional" ? " (optional)" : ""}`} htmlFor="action-reason">
                <Textarea id="action-reason" value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
            )}
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant={danger ? "danger" : "primary"} loading={pending} disabled={reason === "required" && note.trim().length < 5} onClick={exec}>
                {confirm?.cta ?? label}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

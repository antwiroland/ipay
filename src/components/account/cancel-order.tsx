"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelMyOrderAction } from "@/app/actions/orders";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/overlays";
import { Alert, Field, Textarea } from "@/components/ui/primitives";

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-soft">Cancel application</Button>
      </DialogTrigger>
      <DialogContent title="Cancel this application?" description="The device will be released and you can apply again later.">
        <div className="space-y-4">
          <Field label="Reason" htmlFor="cancel-reason">
            <Textarea id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. I changed my mind about the model" />
          </Field>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Keep application</Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await cancelMyOrderAction(orderId, reason);
                  if (r.ok) {
                    toast.success(r.message ?? "Cancelled");
                    setOpen(false);
                    router.refresh();
                  } else setError(r.error);
                })
              }
            >
              Cancel application
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

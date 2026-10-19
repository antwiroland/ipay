"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteProductAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { Alert, Field, Input } from "@/components/ui/primitives";

/** Delete with typed confirmation. Products that have orders can only be archived (history must be kept). */
export function DeleteProductDialog({
  id,
  name,
  hasOrders,
  open,
  onOpenChange,
  onArchive,
  redirectTo,
}: {
  id: string;
  name: string;
  hasOrders: boolean;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onArchive?: () => void;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setConfirm(""); setError(null); } }}>
      <DialogContent title={hasOrders ? "This product can't be deleted" : `Delete ${name}?`} description={hasOrders ? undefined : "This permanently removes the product. This cannot be undone."}>
        {hasOrders ? (
          <div className="space-y-4">
            <Alert tone="warning">Customers have ordered this device, so deleting it would break their order history and your reports. Archive it instead — it disappears from the store, and you can restore it later.</Alert>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              {onArchive && <Button onClick={() => { onArchive(); onOpenChange(false); }}>Archive instead</Button>}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label={<>Type <strong>DELETE</strong> to confirm</>} htmlFor={`del-${id}`}>
              <Input id={`del-${id}`} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
            </Field>
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button
                variant="danger"
                loading={pending}
                disabled={confirm !== "DELETE"}
                onClick={() =>
                  start(async () => {
                    const r = await deleteProductAction(id);
                    if (r.ok) {
                      toast.success(`${r.data.name} deleted`);
                      onOpenChange(false);
                      if (redirectTo) router.push(redirectTo);
                      router.refresh();
                    } else setError(r.error);
                  })
                }
              >
                <Trash2 /> Delete product
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function DeleteProductButton(props: { id: string; name: string; hasOrders: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => setOpen(true)}><Trash2 /> Delete product</Button>
      <DeleteProductDialog {...props} open={open} onOpenChange={setOpen} redirectTo="/admin/products" />
    </>
  );
}

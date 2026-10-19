"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { productFlagsAction, stockAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";
import { Alert, Field, Input, Select } from "@/components/ui/primitives";

export function ProductRowActions({ id, flags }: { id: string; flags: { isPublished: boolean; isFeatured: boolean; isAvailable: boolean; isArchived: boolean } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [stockOpen, setStockOpen] = useState(false);
  const [s, setS] = useState({ type: "restock", quantity: "", note: "" });
  const [error, setError] = useState<string | null>(null);
  const flag = (f: Partial<typeof flags>) =>
    start(async () => {
      const r = await productFlagsAction(id, f);
      if (r.ok) { toast.success(r.message ?? "Updated"); router.refresh(); } else toast.error(r.error);
    });
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Product actions" disabled={pending}><MoreHorizontal /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem asChild><Link href={`/admin/products/${id}/edit`}>Edit</Link></DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setStockOpen(true)}>Adjust stock…</DropdownMenuItem>
          <DropdownMenuSeparator />
          {!flags.isArchived && <DropdownMenuItem onSelect={() => flag({ isPublished: !flags.isPublished })}>{flags.isPublished ? "Unpublish" : "Publish"}</DropdownMenuItem>}
          <DropdownMenuItem onSelect={() => flag({ isFeatured: !flags.isFeatured })}>{flags.isFeatured ? "Remove from featured" : "Mark featured"}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => flag({ isAvailable: !flags.isAvailable })}>{flags.isAvailable ? "Mark unavailable" : "Mark available"}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-danger" onSelect={() => flag({ isArchived: !flags.isArchived })}>{flags.isArchived ? "Restore from archive" : "Archive (discontinue)"}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={stockOpen} onOpenChange={setStockOpen}>
        <DialogContent title="Adjust stock" description="Every change is recorded as an inventory movement.">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type" htmlFor="st-type">
                <Select id="st-type" value={s.type} onChange={(e) => setS({ ...s, type: e.target.value })}>
                  <option value="restock">Restock (+)</option><option value="adjustment">Adjustment (±)</option>
                </Select>
              </Field>
              <Field label="Quantity" htmlFor="st-q" hint={s.type === "adjustment" ? "Use negative numbers to remove" : undefined}>
                <Input id="st-q" inputMode="numeric" value={s.quantity} onChange={(e) => setS({ ...s, quantity: e.target.value })} />
              </Field>
            </div>
            <Field label="Note" htmlFor="st-n"><Input id="st-n" value={s.note} onChange={(e) => setS({ ...s, note: e.target.value })} placeholder="e.g. Shipment from supplier #221" /></Field>
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStockOpen(false)}>Cancel</Button>
              <Button loading={pending} onClick={() => start(async () => {
                const r = await stockAction(id, s);
                if (r.ok) { toast.success(`Stock now ${r.data.stock}`); setStockOpen(false); setS({ type: "restock", quantity: "", note: "" }); router.refresh(); } else setError(r.error);
              })}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

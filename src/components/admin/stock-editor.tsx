"use client";

import { Minus, PackageMinus, PackagePlus, PencilLine, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { stockAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { Alert, Field, Input } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type Op = "add" | "remove" | "set";

const OPS: { op: Op; label: string; icon: typeof Plus; hint: string }[] = [
  { op: "add", label: "Add stock", icon: PackagePlus, hint: "New units received" },
  { op: "remove", label: "Remove stock", icon: PackageMinus, hint: "Damaged, lost, returned to supplier" },
  { op: "set", label: "Set exact count", icon: PencilLine, hint: "Correct after a physical count" },
];

/** Stock count with Add / Remove / Set controls. `variant="cell"` is compact for tables. */
export function StockEditor({ productId, name, stock, variant = "cell" }: { productId: string; name: string; stock: number; variant?: "cell" | "card" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [op, setOp] = useState<Op>("add");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const n = Math.max(0, Math.floor(Number(qty) || 0));
  const next = op === "add" ? stock + n : op === "remove" ? stock - n : n;
  const invalid = next < 0 || (op !== "set" && n === 0) || (op === "set" && n === stock) || (op !== "add" && note.trim().length < 3);

  const openWith = (o: Op) => {
    setOp(o);
    setQty(o === "set" ? String(stock) : "1");
    setNote("");
    setErrors({});
    setError(null);
    setOpen(true);
  };

  const save = () =>
    start(async () => {
      const r = await stockAction(productId, { op, quantity: n, note });
      if (r.ok) {
        toast.success(`${name}: stock is now ${r.data.stock}`);
        setOpen(false);
        router.refresh();
      } else {
        setError(r.error);
        setErrors(r.fieldErrors ?? {});
      }
    });

  const tone = stock === 0 ? "text-danger" : stock <= 2 ? "text-warning" : "text-foreground";

  return (
    <>
      {variant === "cell" ? (
        <div className="flex items-center justify-end gap-1">
          <button type="button" onClick={() => openWith("remove")} disabled={stock === 0} className="grid size-7 place-items-center rounded-md border border-border text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-40" aria-label={`Remove stock for ${name}`}>
            <Minus className="size-3.5" />
          </button>
          <button type="button" onClick={() => openWith("set")} className={cn("tabular min-w-10 rounded-md px-1.5 py-1 text-center font-semibold hover:bg-surface-2", tone)} aria-label={`Set stock for ${name} (currently ${stock})`} title="Set exact count">
            {stock}
          </button>
          <button type="button" onClick={() => openWith("add")} className="grid size-7 place-items-center rounded-md border border-border text-muted hover:bg-surface-2 hover:text-foreground" aria-label={`Add stock for ${name}`}>
            <Plus className="size-3.5" />
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-[13px] text-muted">Available to sell</p>
            <p className={cn("tabular text-3xl font-semibold", tone)}>{stock} <span className="text-base font-normal text-muted">units</span></p>
            {stock === 0 && <p className="text-[12.5px] text-danger">Out of stock — customers can&apos;t apply for this device.</p>}
          </div>
          <div className="grid gap-2">
            {OPS.map(({ op: o, label, icon: Icon }) => (
              <Button key={o} variant={o === "add" ? "primary" : "outline"} onClick={() => openWith(o)} disabled={o === "remove" && stock === 0} className="justify-start">
                <Icon /> {label}
              </Button>
            ))}
          </div>
          <p className="text-[12px] text-muted">Units reserved by customer orders are already deducted. Every change is logged with who made it.</p>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={`Update stock · ${name}`} description={`Currently ${stock} in stock.`}>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-1 rounded-[12px] bg-surface-2 p-1" role="tablist" aria-label="Stock action">
              {OPS.map(({ op: o, label }) => (
                <button
                  key={o}
                  type="button"
                  role="tab"
                  aria-selected={op === o}
                  onClick={() => openWith(o)}
                  disabled={o === "remove" && stock === 0}
                  className={cn("rounded-[9px] px-2 py-2 text-[13px] font-medium transition disabled:opacity-40", op === o ? "bg-surface shadow-sm" : "text-muted hover:text-foreground")}
                >
                  {label.replace(" stock", "").replace(" exact count", " exact")}
                </button>
              ))}
            </div>
            <p className="text-[12.5px] text-muted">{OPS.find((x) => x.op === op)!.hint}</p>

            <Field label={op === "set" ? "New stock count" : op === "add" ? "Units to add" : "Units to remove"} htmlFor="stock-qty" error={errors.quantity}>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" aria-label="Decrease" onClick={() => setQty(String(Math.max(0, n - 1)))}><Minus /></Button>
                <Input id="stock-qty" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} className="tabular text-center text-lg font-semibold" />
                <Button variant="outline" size="icon" aria-label="Increase" onClick={() => setQty(String(n + 1))}><Plus /></Button>
              </div>
            </Field>

            <Field label={op === "add" ? "Note (optional)" : "Reason"} htmlFor="stock-note" error={errors.note} hint={op === "add" ? "e.g. Supplier delivery #221" : "e.g. Screen damaged in storage"}>
              <Input id="stock-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>

            <div className="flex items-center justify-between rounded-[12px] border border-border p-3 text-sm">
              <span className="text-muted">Stock after this change</span>
              <span className={cn("tabular text-lg font-semibold", next < 0 && "text-danger")}>
                {stock} → {next < 0 ? "not allowed" : next}
              </span>
            </div>

            {error && <Alert tone="danger">{error}</Alert>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} loading={pending} disabled={invalid}>Save stock</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

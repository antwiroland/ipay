"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveProductAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardContent, CardHeader, CardTitle, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { cedisToPesewas, formatGHS } from "@/lib/money";
import { quote } from "@/lib/pricing";
import { GalleryEditor, type Img } from "./image-uploader";

export interface ProductFormValues {
  name: string;
  slug: string;
  description: string;
  model: string;
  series: string;
  storage: string;
  condition: "brand_new" | "uk_used";
  colourOptions: { name: string; hex: string }[];
  images: Img[];
  specs: { label: string; value: string }[];
  cashPrice: string;
  installmentPrice: string;
  costPrice: string;
  promoCashPrice: string;
  promoInstallmentPrice: string;
  promoStartsAt: string;
  promoEndsAt: string;
  addOns: { key: string; name: string; price: string }[];
  planIds: string[];
  isFeatured: boolean;
  isPublished: boolean;
  isAvailable: boolean;
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export function ProductForm({
  productId,
  initial,
  plans,
}: {
  productId: string | null;
  initial: ProductFormValues;
  plans: { id: string; name: string; purchaseModel: string; depositType: "percentage" | "fixed"; depositValue: number; frequency: "weekly" | "monthly"; numberOfInstallments: number; markupBps: number; fees: { name: string; amount: number }[] }[];
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [stock, setStock] = useState("0");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof ProductFormValues>(k: K, val: ProductFormValues[K]) => setV((s) => ({ ...s, [k]: val }));
  const err = (k: string) => errors[k];

  let preview: { name: string; deposit: number; regular: number; n: number; total: number; f: string }[] = [];
  try {
    const p = { cashPrice: cedisToPesewas(v.cashPrice || "0"), installmentPrice: cedisToPesewas(v.installmentPrice || "0") };
    if (p.installmentPrice > 0) {
      preview = plans
        .filter((pl) => !v.planIds.length || v.planIds.includes(pl.id))
        .map((pl) => {
          const q = quote(p, pl as never);
          return { name: pl.name, deposit: q.deposit, regular: q.regularInstallment, n: q.numberOfInstallments, total: q.contractPrice, f: pl.frequency };
        });
    }
  } catch {
    preview = [];
  }

  const submit = (publish?: boolean) =>
    start(async () => {
      setError(null);
      const payload = {
        ...v,
        isPublished: publish ?? v.isPublished,
        promoCashPrice: v.promoCashPrice || null,
        promoInstallmentPrice: v.promoInstallmentPrice || null,
        promoStartsAt: v.promoStartsAt || null,
        promoEndsAt: v.promoEndsAt || null,
      };
      const r = await saveProductAction(productId, payload, Number(stock) || 0);
      if (r.ok) {
        toast.success(r.message ?? "Saved");
        setErrors({});
        if (!productId) router.push(`/admin/products/${r.data.id}/edit`);
        else router.refresh();
      } else {
        setError(r.error);
        setErrors(r.fieldErrors ?? {});
      }
    });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {error && <Alert tone="danger">{error}</Alert>}
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Display name" htmlFor="name" error={err("name")}>
              <Input id="name" value={v.name} onChange={(e) => { set("name", e.target.value); if (!productId) set("slug", slugify(e.target.value)); }} placeholder="iPhone 15 Pro 256GB" />
            </Field>
            <Field label="URL slug" htmlFor="slug" error={err("slug")} hint={`/products/${v.slug || "…"}`}>
              <Input id="slug" value={v.slug} onChange={(e) => set("slug", e.target.value)} />
            </Field>
            <Field label="Model" htmlFor="model" error={err("model")}><Input id="model" value={v.model} onChange={(e) => set("model", e.target.value)} placeholder="iPhone 15 Pro" /></Field>
            <Field label="Series (number)" htmlFor="series" error={err("series")}><Input id="series" inputMode="numeric" value={v.series} onChange={(e) => set("series", e.target.value)} placeholder="15" /></Field>
            <Field label="Storage" htmlFor="storage" error={err("storage")}><Input id="storage" value={v.storage} onChange={(e) => set("storage", e.target.value.toUpperCase())} placeholder="256GB" /></Field>
            <Field label="Condition" htmlFor="condition">
              <Select id="condition" value={v.condition} onChange={(e) => set("condition", e.target.value as never)}>
                <option value="brand_new">Brand new</option><option value="uk_used">UK used</option>
              </Select>
            </Field>
            <Field label="Description" htmlFor="desc" className="sm:col-span-2" error={err("description")}>
              <Textarea id="desc" value={v.description} onChange={(e) => set("description", e.target.value)} rows={4} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Images</CardTitle></CardHeader>
          <CardContent>
            <GalleryEditor value={v.images} onChange={(imgs) => set("images", imgs)} defaultAlt={v.name} />
            {err("images") && <p className="mt-2 text-[12.5px] text-danger">{err("images")![0]}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Pricing (GH₵)</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Field label="Cash price" htmlFor="cash" error={err("cashPrice")}><Input id="cash" inputMode="decimal" value={v.cashPrice} onChange={(e) => set("cashPrice", e.target.value)} /></Field>
            <Field label="Installment price" htmlFor="inst" error={err("installmentPrice")} hint="Must be ≥ cash price"><Input id="inst" inputMode="decimal" value={v.installmentPrice} onChange={(e) => set("installmentPrice", e.target.value)} /></Field>
            <Field label="Cost price (internal)" htmlFor="cost" error={err("costPrice")} hint="For COGS & inventory value"><Input id="cost" inputMode="decimal" value={v.costPrice} onChange={(e) => set("costPrice", e.target.value)} /></Field>
            <Field label="Promo installment price" htmlFor="pi" error={err("promoInstallmentPrice")}><Input id="pi" inputMode="decimal" value={v.promoInstallmentPrice} onChange={(e) => set("promoInstallmentPrice", e.target.value)} /></Field>
            <Field label="Promo cash price" htmlFor="pc" error={err("promoCashPrice")}><Input id="pc" inputMode="decimal" value={v.promoCashPrice} onChange={(e) => set("promoCashPrice", e.target.value)} /></Field>
            <div />
            <Field label="Promo starts" htmlFor="ps" error={err("promoStartsAt")}><Input id="ps" type="datetime-local" value={v.promoStartsAt} onChange={(e) => set("promoStartsAt", e.target.value)} /></Field>
            <Field label="Promo ends" htmlFor="pe" error={err("promoEndsAt")}><Input id="pe" type="datetime-local" value={v.promoEndsAt} onChange={(e) => set("promoEndsAt", e.target.value)} /></Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Colours</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {v.colourOptions.map((c, i) => (
              <div key={i} className="flex gap-2">
                <input type="color" aria-label="Colour swatch" value={c.hex} onChange={(e) => set("colourOptions", v.colourOptions.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))} className="h-10 w-12 rounded-md border border-border" />
                <Input aria-label="Colour name" value={c.name} onChange={(e) => set("colourOptions", v.colourOptions.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <Button variant="ghost" size="icon" type="button" aria-label="Remove colour" onClick={() => set("colourOptions", v.colourOptions.filter((_, j) => j !== i))}><Trash2 /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" type="button" onClick={() => set("colourOptions", [...v.colourOptions, { name: "", hex: "#cccccc" }])}><Plus /> Add colour</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Specifications</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {v.specs.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2">
                <Input aria-label="Spec label" placeholder="Display" value={s.label} onChange={(e) => set("specs", v.specs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <Input aria-label="Spec value" placeholder='6.1″ Super Retina XDR' value={s.value} onChange={(e) => set("specs", v.specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                <Button variant="ghost" size="icon" type="button" aria-label="Remove spec" onClick={() => set("specs", v.specs.filter((_, j) => j !== i))}><Trash2 /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" type="button" onClick={() => set("specs", [...v.specs, { label: "", value: "" }])}><Plus /> Add spec</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Add-on products</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {v.addOns.map((a, i) => (
              <div key={i} className="grid grid-cols-[1fr_2fr_1fr_auto] gap-2">
                <Input aria-label="Add-on key" placeholder="case" value={a.key} onChange={(e) => set("addOns", v.addOns.map((x, j) => (j === i ? { ...x, key: slugify(e.target.value) } : x)))} />
                <Input aria-label="Add-on name" placeholder="Clear case" value={a.name} onChange={(e) => set("addOns", v.addOns.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <Input aria-label="Add-on price" placeholder="180" inputMode="decimal" value={a.price} onChange={(e) => set("addOns", v.addOns.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
                <Button variant="ghost" size="icon" type="button" aria-label="Remove add-on" onClick={() => set("addOns", v.addOns.filter((_, j) => j !== i))}><Trash2 /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" type="button" onClick={() => set("addOns", [...v.addOns, { key: "", name: "", price: "" }])}><Plus /> Add add-on</Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
        <Card>
          <CardHeader><CardTitle>Publishing</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {(
              [
                ["isPublished", "Published on storefront"],
                ["isAvailable", "Available to order"],
                ["isFeatured", "Featured on homepage"],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2.5">
                <input type="checkbox" className="size-4 accent-[var(--foreground)]" checked={v[k]} onChange={(e) => set(k, e.target.checked)} /> {label}
              </label>
            ))}
            {!productId && (
              <Field label="Initial stock" htmlFor="stock"><Input id="stock" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value.replace(/\D/g, ""))} /></Field>
            )}
            <div className="flex gap-2 pt-2">
              <Button className="flex-1" loading={pending} onClick={() => submit()}>Save</Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Installment plans</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-[12.5px] text-muted">Leave all unchecked to offer every active plan.</p>
            {plans.map((p) => (
              <label key={p.id} className="flex items-center gap-2.5">
                <input type="checkbox" className="size-4 accent-[var(--foreground)]" checked={v.planIds.includes(p.id)} onChange={(e) => set("planIds", e.target.checked ? [...v.planIds, p.id] : v.planIds.filter((x) => x !== p.id))} />
                {p.name}
              </label>
            ))}
          </CardContent>
        </Card>
        {preview.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Calculator preview</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-[13px]">
              {preview.map((p) => (
                <div key={p.name} className="rounded-[10px] bg-surface-2 p-2.5">
                  <p className="font-medium">{p.name}</p>
                  <p className="tabular text-muted">{formatGHS(p.deposit)} deposit + {p.n} × {formatGHS(p.regular)} = {formatGHS(p.total)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

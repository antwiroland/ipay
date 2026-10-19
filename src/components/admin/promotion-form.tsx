"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { savePromotionAction } from "@/app/actions/admin";
import { HeroCarousel } from "@/components/store/hero-carousel";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardContent, CardHeader, CardTitle, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { SingleImageField } from "./image-uploader";

export interface PromotionFormValues {
  title: string;
  subtitle: string;
  badge: string;
  desktopImage: string;
  mobileImage: string;
  callToAction: string;
  destinationType: "url" | "product";
  destination: string;
  linkedProductIds: string[];
  discountPercent: string;
  startDate: string;
  endDate: string;
  status: "draft" | "published" | "archived";
  displayOrder: string;
  showCountdown: boolean;
}

export function PromotionForm({ id, initial, products }: { id: string | null; initial: PromotionFormValues; products: { id: string; slug: string; name: string }[] }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof PromotionFormValues>(k: K, val: PromotionFormValues[K]) => setV((s) => ({ ...s, [k]: val }));

  const save = (status?: PromotionFormValues["status"]) =>
    start(async () => {
      setError(null);
      const r = await savePromotionAction(id, { ...v, status: status ?? v.status, badge: v.badge || null });
      if (r.ok) {
        toast.success(r.message ?? "Saved");
        setErrors({});
        if (status) set("status", status);
        if (!id) router.push(`/admin/promotions/${r.data.id}`);
        else router.refresh();
      } else {
        setError(r.error);
        setErrors(r.fieldErrors ?? {});
      }
    });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Preview</CardTitle></CardHeader>
        <CardContent>
          {v.desktopImage ? (
            <HeroCarousel
              slides={[{ id: "preview", title: v.title || "Campaign title", subtitle: v.subtitle, badge: v.badge, desktopImage: v.desktopImage, mobileImage: v.mobileImage || v.desktopImage, callToAction: v.callToAction || "Shop now", href: "#", endDate: v.endDate || new Date().toISOString(), showCountdown: v.showCountdown }]}
            />
          ) : (
            <p className="text-sm text-muted">Upload a desktop image to preview the banner.</p>
          )}
        </CardContent>
      </Card>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Content</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Field label="Campaign title" htmlFor="t" error={errors.title}><Input id="t" value={v.title} onChange={(e) => set("title", e.target.value)} /></Field>
            <Field label="Subtitle" htmlFor="s" error={errors.subtitle}><Textarea id="s" value={v.subtitle} onChange={(e) => set("subtitle", e.target.value)} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Badge (optional)" htmlFor="b"><Input id="b" value={v.badge} onChange={(e) => set("badge", e.target.value)} placeholder="Limited time" /></Field>
              <Field label="Call-to-action text" htmlFor="c" error={errors.callToAction}><Input id="c" value={v.callToAction} onChange={(e) => set("callToAction", e.target.value)} /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Destination type" htmlFor="dt">
                <Select id="dt" value={v.destinationType} onChange={(e) => set("destinationType", e.target.value as never)}>
                  <option value="url">Internal page / URL</option><option value="product">Product</option>
                </Select>
              </Field>
              {v.destinationType === "product" ? (
                <Field label="Linked product" htmlFor="dp" error={errors.destination}>
                  <Select id="dp" value={v.destination} onChange={(e) => set("destination", e.target.value)}>
                    <option value="">Choose…</option>
                    {products.map((p) => <option key={p.id} value={p.slug}>{p.name}</option>)}
                  </Select>
                </Field>
              ) : (
                <Field label="Destination" htmlFor="du" error={errors.destination} hint="e.g. /shop?series=17"><Input id="du" value={v.destination} onChange={(e) => set("destination", e.target.value)} /></Field>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <SingleImageField label="Desktop image (≈1600×640)" folder="banners" value={v.desktopImage} onChange={(u) => set("desktopImage", u)} />
              <SingleImageField label="Mobile image (≈800×1000)" folder="banners" value={v.mobileImage} onChange={(u) => set("mobileImage", u)} />
            </div>
            {(errors.desktopImage || errors.mobileImage) && <p className="text-[12.5px] text-danger">{(errors.desktopImage ?? errors.mobileImage)![0]}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Schedule & offer</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starts" htmlFor="sd" error={errors.startDate}><Input id="sd" type="datetime-local" value={v.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field>
              <Field label="Ends" htmlFor="ed" error={errors.endDate}><Input id="ed" type="datetime-local" value={v.endDate} onChange={(e) => set("endDate", e.target.value)} /></Field>
              <Field label="Display order" htmlFor="do"><Input id="do" inputMode="numeric" value={v.displayOrder} onChange={(e) => set("displayOrder", e.target.value)} /></Field>
              <Field label="Campaign discount (%)" htmlFor="dc" hint="Applied to linked products' installment price during the campaign"><Input id="dc" inputMode="decimal" value={v.discountPercent} onChange={(e) => set("discountPercent", e.target.value)} /></Field>
            </div>
            <label className="flex items-center gap-2.5 text-sm"><input type="checkbox" className="size-4 accent-[var(--foreground)]" checked={v.showCountdown} onChange={(e) => set("showCountdown", e.target.checked)} /> Show countdown to end date</label>
            <fieldset>
              <legend className="text-[13px] font-medium">Featured / discounted products</legend>
              <div className="mt-2 grid max-h-56 gap-1.5 overflow-y-auto rounded-[12px] border border-border p-3 text-sm sm:grid-cols-2">
                {products.map((p) => (
                  <label key={p.id} className="flex items-center gap-2">
                    <input type="checkbox" className="size-4 accent-[var(--foreground)]" checked={v.linkedProductIds.includes(p.id)} onChange={(e) => set("linkedProductIds", e.target.checked ? [...v.linkedProductIds, p.id] : v.linkedProductIds.filter((x) => x !== p.id))} />
                    {p.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button variant="outline" loading={pending} onClick={() => save("draft")}>Save as draft</Button>
              <Button loading={pending} onClick={() => save("published")}>Save & publish</Button>
              <p className="w-full text-[12px] text-muted">Published campaigns appear on the storefront only between their start and end dates.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

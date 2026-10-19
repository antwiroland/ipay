"use client";

import { ArrowLeft, ArrowRight, ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ProductImage } from "@/components/store/product-image";

export type Img = { url: string; alt: string; publicId?: string | null };

export async function uploadImage(file: File, folder: "products" | "banners"): Promise<Img | null> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`/api/admin/upload?folder=${folder}`, { method: "POST", body: fd });
  const json = await res.json();
  if (!res.ok) {
    toast.error(json.error ?? "Upload failed");
    return null;
  }
  return { url: json.url, publicId: json.publicId, alt: "" };
}

export function GalleryEditor({ value, onChange, defaultAlt }: { value: Img[]; onChange: (v: Img[]) => void; defaultAlt: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const move = (i: number, d: number) => {
    const next = [...value];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    onChange(next);
  };
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {value.map((img, i) => (
          <div key={img.url} className="group relative rounded-[12px] border border-border bg-surface-2 p-2">
            <div className="relative aspect-square"><ProductImage src={img.url} alt={img.alt} sizes="160px" /></div>
            <input
              className="mt-2 w-full rounded-md border border-border bg-surface px-2 py-1 text-[12px]"
              placeholder="Alt text"
              aria-label={`Alt text for image ${i + 1}`}
              value={img.alt}
              onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, alt: e.target.value } : v)))}
            />
            <div className="absolute top-1 right-1 flex gap-1">
              {i > 0 && <button type="button" onClick={() => move(i, -1)} className="rounded bg-surface/90 p-1" aria-label="Move left"><ArrowLeft className="size-3.5" /></button>}
              {i < value.length - 1 && <button type="button" onClick={() => move(i, 1)} className="rounded bg-surface/90 p-1" aria-label="Move right"><ArrowRight className="size-3.5" /></button>}
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded bg-surface/90 p-1 text-danger" aria-label="Remove image"><X className="size-3.5" /></button>
            </div>
            {i === 0 && <span className="absolute top-1 left-1 rounded bg-foreground px-1.5 text-[10px] text-white">Cover</span>}
          </div>
        ))}
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="grid aspect-square place-items-center rounded-[12px] border-2 border-dashed border-border-strong text-muted hover:border-accent hover:text-accent"
          disabled={busy}
        >
          {busy ? <Loader2 className="size-6 animate-spin" /> : <span className="flex flex-col items-center gap-1 text-[12.5px]"><ImagePlus className="size-6" />Add images</span>}
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        hidden
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          setBusy(true);
          const added: Img[] = [];
          for (const f of files) {
            const r = await uploadImage(f, "products");
            if (r) added.push({ ...r, alt: defaultAlt });
          }
          onChange([...value, ...added]);
          setBusy(false);
          e.target.value = "";
        }}
      />
      <p className="mt-2 text-[12px] text-muted">JPG, PNG, WebP or AVIF, up to 5 MB each. The first image is the cover.</p>
    </div>
  );
}

export function SingleImageField({ value, onChange, folder, label }: { value: string; onChange: (v: string) => void; folder: "banners" | "products"; label: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium">{label}</p>
      <button type="button" onClick={() => input.current?.click()} className="relative block aspect-[16/7] w-full overflow-hidden rounded-[12px] border-2 border-dashed border-border-strong bg-surface-2 text-muted hover:border-accent">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-[12.5px]">{busy ? "Uploading…" : "Click to upload"}</span>}
      </button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setBusy(true);
        const r = await uploadImage(f, folder);
        if (r) onChange(r.url);
        setBusy(false);
      }} />
    </div>
  );
}

import { Download } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, Input, Select } from "@/components/ui/primitives";

export type FilterField =
  | { type: "search"; name: string; placeholder: string }
  | { type: "select"; name: string; label: string; options: { value: string; label: string }[] }
  | { type: "date"; name: string; label: string };

/** GET-form filter bar: state lives in the URL, so filters are shareable and server-rendered. */
export function FilterBar({ fields, values, exportHref }: { fields: FilterField[]; values: Record<string, string | undefined>; exportHref?: string }) {
  return (
    <Card className="mb-4 p-3 sm:p-4">
      <form className="flex flex-wrap items-end gap-2" role="search">
        {fields.map((f) =>
          f.type === "search" ? (
            <Input key={f.name} name={f.name} defaultValue={values[f.name]} placeholder={f.placeholder} aria-label={f.placeholder} className="w-full sm:w-64" />
          ) : f.type === "select" ? (
            <Select key={f.name} name={f.name} defaultValue={values[f.name] ?? ""} aria-label={f.label} className="w-auto min-w-36">
              <option value="">{f.label}: all</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          ) : (
            <label key={f.name} className="flex flex-col gap-1 text-[12px] text-muted">
              {f.label}
              <Input type="date" name={f.name} defaultValue={values[f.name]} className="w-auto" />
            </label>
          ),
        )}
        <Button type="submit">Apply</Button>
        <Button variant="ghost" asChild><Link href="?">Reset</Link></Button>
        {exportHref && (
          <Button variant="outline" className="ml-auto" asChild>
            <a href={exportHref}><Download /> Export CSV</a>
          </Button>
        )}
      </form>
    </Card>
  );
}

export function Pager({ page, pageSize, total, params }: { page: number; pageSize: number; total: number; params: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    q.set("page", String(p));
    return `?${q}`;
  };
  return (
    <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
      <span className="text-muted">
        {total === 0 ? "No results" : `Showing ${(page - 1) * pageSize + 1}–${Math.min(total, page * pageSize)} of ${total.toLocaleString()}`}
      </span>
      {pages > 1 && (
        <div className="flex gap-2">
          {page > 1 && <Button size="sm" variant="outline" asChild><Link href={href(page - 1)}>Previous</Link></Button>}
          {page < pages && <Button size="sm" variant="outline" asChild><Link href={href(page + 1)}>Next</Link></Button>}
        </div>
      )}
    </nav>
  );
}

export function exportUrl(type: string, params: Record<string, string | undefined>) {
  const q = new URLSearchParams(Object.entries(params).filter(([k, v]) => v && k !== "page") as [string, string][]);
  return `/api/admin/export/${type}?${q}`;
}

export function pageOf(v: string | undefined) {
  return Math.max(1, Math.floor(Number(v) || 1));
}

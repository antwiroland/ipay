import { Plus } from "lucide-react";
import Link from "next/link";
import { FilterBar } from "@/components/admin/list-controls";
import { ProductRowActions } from "@/components/admin/product-row-actions";
import { StockEditor } from "@/components/admin/stock-editor";
import { ProductImage } from "@/components/store/product-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/primitives";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatGHS } from "@/lib/money";
import { isPromoActive } from "@/lib/pricing";
import { escapeRegex } from "@/lib/validation";
import { Order, Product } from "@/models";
import { requireStaffPage } from "@/server/auth/session";
import { getSettings } from "@/server/services/settings";

export const metadata = { title: "Products & Offers" };

export default async function AdminProducts({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaffPage("products.manage", "/admin/products");
  const sp = await searchParams;
  const f: Record<string, unknown> = {};
  if (sp.view === "archived") f.isArchived = true;
  else f.isArchived = false;
  if (sp.view === "draft") f.isPublished = false;
  if (sp.view === "low") f.stockQuantity = { $lte: 2 };
  if (sp.q) f.$or = [{ name: new RegExp(escapeRegex(sp.q.slice(0, 60)), "i") }, { slug: new RegExp(escapeRegex(sp.q.slice(0, 60)), "i") }];
  const [products, settings, ordered] = await Promise.all([Product.find(f).sort({ series: -1, installmentPrice: -1 }).lean(), getSettings(), Order.distinct("productId")]);
  const hasOrders = new Set(ordered.map(String));
  return (
    <div>
      <PageHeader
        title={settings.productsMenuLabel}
        description="Catalogue, pricing, stock and publication."
        actions={<Button asChild><Link href="/admin/products/new"><Plus /> Add iPhone</Link></Button>}
      />
      <FilterBar
        values={sp}
        fields={[
          { type: "search", name: "q", placeholder: "Search products" },
          { type: "select", name: "view", label: "View", options: [{ value: "draft", label: "Unpublished" }, { value: "low", label: "Low stock (≤2)" }, { value: "archived", label: "Archived" }] },
        ]}
      />
      <Table className="min-w-[960px]">
        <THead>
          <tr><TH>Product</TH><TH>Condition</TH><TH className="text-right">Cash</TH><TH className="text-right">Installment</TH><TH className="text-right">Cost</TH><TH className="text-right">Stock (− / set / +)</TH><TH>Status</TH><TH /></tr>
        </THead>
        <TBody>
          {products.length === 0 && <tr><TD colSpan={8} className="py-10 text-center text-muted">No products.</TD></tr>}
          {products.map((p) => (
            <TR key={p._id.toString()}>
              <TD>
                <Link href={`/admin/products/${p._id}/edit`} className="flex items-center gap-3">
                  <span className="relative size-11 shrink-0 rounded-[10px] bg-surface-2"><ProductImage src={p.images?.[0]?.url ?? ""} alt="" sizes="44px" className="p-1" /></span>
                  <span>
                    <span className="block font-medium hover:underline">{p.name}</span>
                    <span className="block text-[12px] text-muted">/{p.slug}</span>
                  </span>
                </Link>
              </TD>
              <TD>{p.condition === "brand_new" ? "Brand new" : "UK used"}</TD>
              <TD className="tabular text-right">{formatGHS(p.cashPrice)}</TD>
              <TD className="tabular text-right">
                {formatGHS(p.installmentPrice)}
                {isPromoActive(p) && <span className="block text-[12px] text-accent">Promo {formatGHS(p.promoInstallmentPrice!)}</span>}
              </TD>
              <TD className="tabular text-right text-muted">{formatGHS(p.costPrice)}</TD>
              <TD className="text-right"><StockEditor productId={p._id.toString()} name={p.name} stock={p.stockQuantity} /></TD>
              <TD>
                <div className="flex flex-wrap gap-1">
                  {p.isArchived ? <Badge tone="grey">Archived</Badge> : p.isPublished ? <Badge tone="success">Published</Badge> : <Badge tone="neutral">Draft</Badge>}
                  {p.isFeatured && <Badge tone="accent">Featured</Badge>}
                  {!p.isAvailable && <Badge tone="warning">Unavailable</Badge>}
                </div>
              </TD>
              <TD className="text-right"><ProductRowActions id={p._id.toString()} name={p.name} hasOrders={hasOrders.has(p._id.toString())} flags={{ isPublished: p.isPublished, isFeatured: p.isFeatured, isAvailable: p.isAvailable, isArchived: p.isArchived }} /></TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

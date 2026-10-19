import { ExternalLink } from "lucide-react";
import { Types } from "mongoose";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteProductButton } from "@/components/admin/delete-product";
import { ProductForm } from "@/components/admin/product-form";
import { StockEditor } from "@/components/admin/stock-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/dates";
import { serialize } from "@/lib/utils";
import { InventoryMovement, Order, Product } from "@/models";
import { requireStaffPage } from "@/server/auth/session";
import { planOptions, toFormValues } from "../../_form-data";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  await requireStaffPage("products.manage", `/admin/products/${productId}/edit`);
  if (!Types.ObjectId.isValid(productId)) notFound();
  const [product, movements, plans, orderCount] = await Promise.all([
    Product.findById(productId).lean(),
    InventoryMovement.find({ productId }).sort({ createdAt: -1 }).limit(20).populate("actorId", "name").lean(),
    planOptions(),
    Order.countDocuments({ productId }),
  ]);
  if (!product) notFound();
  return (
    <div className="space-y-6">
      <PageHeader
        title={product.name}
        description={`${orderCount} order${orderCount === 1 ? "" : "s"} · ${product.isArchived ? "archived" : product.isPublished ? "published" : "draft"}`}
        actions={
          <>
            {product.isPublished && <Button variant="outline" asChild><Link href={`/products/${product.slug}`} target="_blank"><ExternalLink /> View on store</Link></Button>}
            <DeleteProductButton id={productId} name={product.name} hasOrders={orderCount > 0} />
          </>
        }
      />
      <Card>
        <CardHeader><CardTitle>Stock</CardTitle></CardHeader>
        <CardContent><StockEditor productId={productId} name={product.name} stock={product.stockQuantity} variant="card" /></CardContent>
      </Card>
      <ProductForm productId={productId} initial={serialize(toFormValues(product))} plans={plans} />
      <Card>
        <CardHeader><CardTitle>Inventory movements</CardTitle></CardHeader>
        <CardContent>
          {movements.length === 0 ? <p className="text-sm text-muted">No movements yet.</p> : (
            <ul className="divide-y divide-border text-sm">
              {movements.map((m) => (
                <li key={m._id.toString()} className="flex flex-wrap justify-between gap-2 py-2">
                  <span><span className="font-medium capitalize">{m.type}</span> <span className="tabular">{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</span>{m.note ? ` · ${m.note}` : ""}</span>
                  <span className="text-muted">{(m.actorId as unknown as { name?: string })?.name ?? "System"} · {formatDateTime(m.createdAt)}{m.stockAfter != null ? ` · stock ${m.stockAfter}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

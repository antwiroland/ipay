import { ProductForm } from "@/components/admin/product-form";
import { PageHeader } from "@/components/ui/primitives";
import { requireStaffPage } from "@/server/auth/session";
import { planOptions, toFormValues } from "../_form-data";

export const metadata = { title: "Add iPhone" };

export default async function NewProductPage() {
  await requireStaffPage("products.manage", "/admin/products/new");
  return (
    <div>
      <PageHeader title="Add iPhone" description="Products stay as drafts until you publish them." />
      <ProductForm productId={null} initial={toFormValues(null)} plans={await planOptions()} />
    </div>
  );
}

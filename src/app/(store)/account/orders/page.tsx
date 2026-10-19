import { ArrowRight, Package } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatusBadge } from "@/components/status-badges";
import { ProductImage } from "@/components/store/product-image";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Progress } from "@/components/ui/primitives";
import { formatDate } from "@/lib/dates";
import { formatGHS, progressPercent } from "@/lib/money";
import { requireCustomerPage } from "@/server/auth/session";
import { listCustomerOrders } from "@/server/services/orders";

export const metadata: Metadata = { title: "My orders" };

export default async function OrdersPage() {
  const actor = await requireCustomerPage("/account/orders");
  const orders = await listCustomerOrders(actor);
  return (
    <div>
      <PageHeader title="My orders" description="Your active plan and full order history." />
      {orders.length === 0 ? (
        <EmptyState icon={<Package />} title="No orders yet" description="When you apply for an iPhone, it will appear here." action={<Button asChild><Link href="/shop">Browse iPhones</Link></Button>} />
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const pct = progressPercent(o.amountPaid, o.agreedPurchasePrice);
            return (
              <li key={o._id.toString()}>
                <Link href={`/account/orders/${o._id}`} className="group flex flex-col gap-4 rounded-[16px] border border-border bg-surface p-4 transition hover:border-border-strong hover:shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:p-5">
                  <div className="relative size-20 shrink-0 rounded-[14px] bg-surface-2">
                    <ProductImage src={o.productSnapshot.image} alt="" sizes="80px" className="p-2" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <OrderStatusBadge status={o.orderStatus} />
                      {o.isActive && <span className="text-[12px] font-medium text-accent">Active plan</span>}
                    </div>
                    <p className="mt-1 font-semibold">{o.productSnapshot.name} · {o.productSnapshot.colour}</p>
                    <p className="text-[12.5px] text-muted">{o.orderNumber} · {formatDate(o.createdAt)}</p>
                  </div>
                  <div className="w-full sm:w-56">
                    <div className="flex justify-between text-[12.5px]">
                      <span className="tabular text-muted">{formatGHS(o.amountPaid)} of {formatGHS(o.agreedPurchasePrice)}</span>
                      <span className="tabular font-medium">{pct}%</span>
                    </div>
                    <Progress value={pct} className="mt-1.5" tone={o.outstandingBalance === 0 ? "success" : "accent"} />
                  </div>
                  <ArrowRight className="hidden size-4 text-muted transition group-hover:translate-x-0.5 sm:block" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

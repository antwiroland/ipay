import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Statement } from "@/components/documents";
import { PrintButton } from "@/components/print-button";
import { Button } from "@/components/ui/button";
import { User } from "@/models";
import { requireCustomerPage } from "@/server/auth/session";
import { getOrderForActor } from "@/server/services/orders";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Statement" };

export default async function StatementPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const actor = await requireCustomerPage(`/account/orders/${orderId}/statement`);
  const data = await getOrderForActor(actor, orderId).catch(() => null);
  if (!data || data.order.customerId.toString() !== actor.userId || !data.order.depositPaidAt) notFound();
  const [customer, settings] = await Promise.all([User.findById(actor.userId).lean(), getSettings()]);
  return (
    <div className="space-y-4">
      <div className="no-print flex justify-between gap-2">
        <Button variant="ghost" asChild><Link href={`/account/orders/${orderId}`}>← Back to order</Link></Button>
        <PrintButton />
      </div>
      <Statement order={data.order} installments={data.installments} payments={data.payments} customer={customer!} settings={settings} />
    </div>
  );
}

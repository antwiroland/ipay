import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Receipt } from "@/components/documents";
import { PrintButton } from "@/components/print-button";
import { Button } from "@/components/ui/button";
import { Order, User } from "@/models";
import { requireCustomerPage } from "@/server/auth/session";
import { getPaymentForActor } from "@/server/services/payments";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Receipt" };

export default async function ReceiptPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const actor = await requireCustomerPage(`/account/payments/${reference}/receipt`);
  const payment = await getPaymentForActor(actor, reference).catch(() => null);
  if (!payment || payment.customerId.toString() !== actor.userId || !["confirmed", "refunded", "reversed"].includes(payment.status)) notFound();
  const [order, customer, settings] = await Promise.all([Order.findById(payment.orderId).lean(), User.findById(actor.userId).lean(), getSettings()]);
  return (
    <div className="space-y-4">
      <div className="no-print flex justify-between gap-2">
        <Button variant="ghost" asChild><Link href="/account/payments">← Payment history</Link></Button>
        <PrintButton label="Print / Download" />
      </div>
      <Receipt payment={payment} order={order!} customer={customer!} settings={settings} />
    </div>
  );
}

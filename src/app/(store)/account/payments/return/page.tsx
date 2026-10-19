import type { Metadata } from "next";
import { PaymentReturn } from "@/components/account/payment-return";
import { Alert } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Payment status" };

export default async function PaymentReturnPage({ searchParams }: { searchParams: Promise<{ reference?: string; trxref?: string }> }) {
  const sp = await searchParams;
  // Paystack appends ?trxref=&reference=. We only use the reference to look up and re-verify server-side.
  const reference = (sp.reference || sp.trxref || "").slice(0, 60);
  return <div className="py-6">{reference ? <PaymentReturn reference={reference} /> : <Alert tone="danger">Missing payment reference.</Alert>}</div>;
}

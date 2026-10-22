import type { Metadata } from "next";
import { PaymentReturn } from "@/components/account/payment-return";
import { Alert } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Payment status" };

export default async function PaymentReturnPage({ searchParams }: { searchParams: Promise<{ reference?: string | string[]; trxref?: string | string[] }> }) {
  const sp = await searchParams;
  // Paystack appends ?trxref=&reference=. We only use the reference to look up and re-verify server-side.
  // Params may repeat (or carry a stray "?…" suffix), so take the first clean reference-shaped value.
  const candidates = [sp.reference, sp.trxref].flat().map((v) => String(v ?? "").split("?")[0].trim());
  const reference = (candidates.find((v) => /^[A-Z0-9-]{6,60}$/i.test(v)) ?? "").slice(0, 60);
  return <div className="py-6">{reference ? <PaymentReturn reference={reference} /> : <Alert tone="danger">Missing payment reference.</Alert>}</div>;
}

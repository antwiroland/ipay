import { FlaskConical } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { LogoMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { formatGHS } from "@/lib/money";
import { MockCharge, Payment } from "@/models";
import { getActor } from "@/server/auth/session";
import { connectDB } from "@/server/db";
import { mockPaymentsAllowed } from "@/server/payments";
import { setMockOutcome } from "@/server/payments/mock";
import { confirmPayment } from "@/server/services/payments";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sandbox checkout", robots: { index: false } };

async function complete(form: FormData) {
  "use server";
  if (!mockPaymentsAllowed()) notFound();
  const reference = String(form.get("reference"));
  const outcome = String(form.get("outcome")) as "success" | "failed" | "abandoned";
  const channel = form.get("channel") === "card" ? "card" : "mobile_money";
  const actor = await getActor();
  const p = await Payment.findOne({ reference }).lean();
  if (!actor || !p || p.customerId.toString() !== actor.userId) notFound();
  await setMockOutcome(reference, outcome, channel);
  // Simulate the provider webhook (twice, to exercise idempotency) — the return page also re-verifies.
  if (outcome !== "abandoned") {
    await confirmPayment(reference);
    if (form.get("duplicate") === "on") await confirmPayment(reference);
  }
  redirect(`/account/payments/return?reference=${encodeURIComponent(reference)}`);
}

export default async function MockCheckout({ params }: { params: Promise<{ reference: string }> }) {
  if (!mockPaymentsAllowed()) notFound();
  const { reference } = await params;
  await connectDB();
  const [charge, payment, actor] = await Promise.all([MockCharge.findById(reference).lean(), Payment.findOne({ reference }).lean(), getActor()]);
  if (!charge || !payment || !actor || payment.customerId.toString() !== actor.userId) notFound();
  const done = charge.status !== "pending";
  return (
    <main className="grid min-h-screen place-items-center bg-[#eef0f5] p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-[20px] border border-border bg-surface shadow-[var(--shadow-lift)]">
        <div className="flex items-center gap-2 bg-warning-soft px-5 py-2.5 text-[12px] font-semibold tracking-wide text-warning uppercase">
          <FlaskConical className="size-4" /> Development sandbox — no real money
        </div>
        <div className="p-6">
          <div className="flex items-center gap-3">
            <LogoMark />
            <div>
              <p className="text-sm font-semibold">iPay Ghana</p>
              <p className="text-[12px] text-muted">{payment.orderNumber} · {payment.kind.replace("_", " ")}</p>
            </div>
          </div>
          <p className="mt-6 text-[13px] text-muted">Amount</p>
          <p className="tabular text-3xl font-semibold">{formatGHS(charge.amount)}</p>
          <p className="mt-1 font-mono text-[11px] text-subtle">{reference}</p>
          {done ? (
            <p className="mt-6 rounded-lg bg-surface-2 p-3 text-sm">This checkout is already {charge.status}.</p>
          ) : (
            <form action={complete} className="mt-6 space-y-3">
              <input type="hidden" name="reference" value={reference} />
              <fieldset className="grid grid-cols-2 gap-2 text-sm">
                <label className="flex items-center gap-2 rounded-lg border border-border p-2.5"><input type="radio" name="channel" value="mobile_money" defaultChecked /> MoMo</label>
                <label className="flex items-center gap-2 rounded-lg border border-border p-2.5"><input type="radio" name="channel" value="card" /> Card</label>
              </fieldset>
              <label className="flex items-center gap-2 text-[12.5px] text-muted"><input type="checkbox" name="duplicate" /> Also send a duplicate webhook</label>
              <Button type="submit" name="outcome" value="success" className="w-full" size="lg">Approve payment</Button>
              <div className="grid grid-cols-2 gap-2">
                <Button type="submit" name="outcome" value="failed" variant="outline">Decline</Button>
                <Button type="submit" name="outcome" value="abandoned" variant="ghost">Cancel</Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

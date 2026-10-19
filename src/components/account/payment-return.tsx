"use client";

import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { checkPaymentAction } from "@/app/actions/orders";
import { Button } from "@/components/ui/button";
import { formatGHS } from "@/lib/money";

type State = { status: string; orderId?: string; amount?: number; reference: string; error?: string };

/** Polls a server-side verification until the provider gives a final answer (max ~60s). */
export function PaymentReturn({ reference }: { reference: string }) {
  const [s, setS] = useState<State>({ status: "checking", reference });
  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const tick = async () => {
      tries++;
      const r = await checkPaymentAction(reference);
      if (cancelled) return;
      if (!r.ok) return setS({ status: "error", reference, error: r.error });
      setS({ ...r.data });
      if (["pending", "processing", "expired"].includes(r.data.status) && tries < 20) setTimeout(tick, 3000);
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [reference]);

  const orderHref = s.orderId ? `/account/orders/${s.orderId}` : "/account";
  if (s.status === "confirmed")
    return (
      <Panel icon={<CheckCircle2 className="size-10 text-success" />} title="Payment confirmed" body={`We've received ${s.amount ? formatGHS(s.amount) : "your payment"}. Your balance has been updated.`}>
        <Button asChild><Link href={orderHref}>View my plan</Link></Button>
        <Button variant="outline" asChild><Link href={`/account/payments/${reference}/receipt`}>View receipt</Link></Button>
      </Panel>
    );
  if (s.status === "failed")
    return (
      <Panel icon={<XCircle className="size-10 text-danger" />} title="Payment not completed" body="No money has been applied to your balance. If you were charged, it will be reversed by your provider. You can try again now.">
        <Button asChild><Link href={`${orderHref}#pay`}>Try again</Link></Button>
        <Button variant="outline" asChild><Link href="/contact">Contact support</Link></Button>
      </Panel>
    );
  if (s.status === "error")
    return <Panel icon={<XCircle className="size-10 text-danger" />} title="We couldn't find that payment" body={s.error ?? ""}><Button asChild><Link href="/account">Go to dashboard</Link></Button></Panel>;
  if (s.status === "checking")
    return <Panel icon={<Loader2 className="size-10 animate-spin text-accent" />} title="Confirming your payment…" body="This usually takes a few seconds. Please don't close this page." />;
  return (
    <Panel icon={<Clock className="size-10 text-warning" />} title="Payment is still processing" body="Your provider hasn't confirmed this payment yet. We'll update your balance automatically as soon as it's confirmed — you don't need to pay again.">
      <Button asChild><Link href={orderHref}>Back to my plan</Link></Button>
    </Panel>
  );
}

function Panel({ icon, title, body, children }: { icon: React.ReactNode; title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md rounded-[20px] border border-border bg-surface p-8 text-center" role="status" aria-live="polite">
      <div className="mx-auto mb-4 w-fit">{icon}</div>
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted">{body}</p>
      {children && <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

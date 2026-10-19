import { ArrowRight, Bell, PartyPopper, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/account/auto-refresh";
import { PaymentSummary } from "@/components/account/payment-summary";
import { OrderStatusBadge, PaymentStatusBadge, SandboxBadge } from "@/components/status-badges";
import { ProductImage } from "@/components/store/product-image";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/components/ui/primitives";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatGHS } from "@/lib/money";
import { PURCHASE_MODEL_LABEL } from "@/lib/pricing";
import { Installment, Notification, Order, Payment, User } from "@/models";
import { requireCustomerPage } from "@/server/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AccountDashboard() {
  const actor = await requireCustomerPage("/account");
  const [user, orders, recent, notifications] = await Promise.all([
    User.findById(actor.userId).lean(),
    Order.find({ customerId: actor.userId }).sort({ createdAt: -1 }).lean(),
    Payment.find({ customerId: actor.userId }).sort({ createdAt: -1 }).limit(5).lean(),
    Notification.find({ userId: actor.userId, channel: "in_app" }).sort({ createdAt: -1 }).limit(4).lean(),
  ]);
  const active = orders.find((o) => o.isActive);
  const completed = orders.filter((o) => o.orderStatus === "completed");
  const justCompleted = !active && completed[0] && Date.now() - new Date(completed[0].completedAt!).getTime() < 14 * 86400000;
  const installments = active ? await Installment.find({ orderId: active._id }).lean() : [];
  const pendingPayment = recent.some((p) => p.status === "pending" || p.status === "processing");

  return (
    <div className="space-y-6">
      <AutoRefresh pending={pendingPayment} />
      <div>
        <p className="text-sm text-muted">Welcome back,</p>
        <h1 className="text-[28px] font-semibold tracking-tight">{user?.name}</h1>
      </div>

      {justCompleted && (
        <Alert tone="success" icon={<PartyPopper />} title="Congratulations!">
          You have completed your iPay Ghana installment plan. Your outstanding balance is GH₵0.00. You can now explore and order your next device.
        </Alert>
      )}

      {active ? (
        <>
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
              <div className="relative size-24 shrink-0 rounded-[16px] bg-surface-2">
                <ProductImage src={active.productSnapshot.image} alt={active.productSnapshot.name} sizes="96px" className="p-2" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <OrderStatusBadge status={active.orderStatus} />
                  <span className="text-[12.5px] text-muted">{PURCHASE_MODEL_LABEL[active.planSnapshot.purchaseModel]} · {active.planSnapshot.name}</span>
                </div>
                <h2 className="mt-1.5 text-lg font-semibold">{active.productSnapshot.name} · {active.productSnapshot.colour}</h2>
                <p className="text-[13px] text-muted">Order {active.orderNumber} · applied {formatDate(active.createdAt)}</p>
              </div>
              <Button asChild>
                <Link href={`/account/orders/${active._id}`}>
                  {active.orderStatus === "awaiting_deposit" ? "Pay deposit" : ["active_repayment", "awaiting_collection"].includes(active.orderStatus) ? "Make a payment" : "View order"} <ArrowRight />
                </Link>
              </Button>
            </div>
          </Card>
          {active.orderStatus === "submitted" || active.orderStatus === "under_review" ? (
            <Alert tone="info" title="Your application is being reviewed">We'll notify you by SMS and email as soon as it's approved — usually within one business day.</Alert>
          ) : (
            <PaymentSummary
              orderId={active._id.toString()}
              total={active.agreedPurchasePrice}
              paid={active.amountPaid}
              outstanding={active.outstandingBalance}
              nextAmount={active.nextDueAmount ?? null}
              nextDate={active.nextDueDate ?? null}
              depositPending={!active.depositPaidAt}
              installmentsDone={installments.filter((i) => i.status === "paid").length}
              installmentsTotal={active.pricing.installmentAmounts.length}
            />
          )}
        </>
      ) : (
        <EmptyState
          icon={<Smartphone />}
          title="No active installment plan"
          description="Pick an iPhone, choose a plan that fits your budget and track every payment right here."
          action={
            <Button asChild>
              <Link href="/shop">Browse iPhones <ArrowRight /></Link>
            </Button>
          }
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent transactions</CardTitle>
            <Link href="/account/payments" className="text-sm font-medium text-accent hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted">No transactions yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {recent.map((p) => (
                  <li key={p.reference} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium capitalize">{p.kind.replace("_", " ")} · {p.orderNumber}</p>
                      <p className="text-[12.5px] text-muted">{formatDateTime(p.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.isTest && <SandboxBadge />}
                      <span className="tabular text-sm font-semibold">{formatGHS(p.amount)}</span>
                      <PaymentStatusBadge status={p.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Notifications</CardTitle>
            <Link href="/account/notifications" className="text-sm font-medium text-accent hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            {notifications.length === 0 ? (
              <p className="text-sm text-muted">You're all caught up.</p>
            ) : (
              <ul className="space-y-3">
                {notifications.map((n) => (
                  <li key={n._id.toString()} className="flex gap-3">
                    <Bell className={`mt-0.5 size-4 shrink-0 ${n.readAt ? "text-subtle" : "text-accent"}`} />
                    <div>
                      <p className="text-sm font-medium">{n.subject}</p>
                      <p className="text-[12.5px] text-muted">{formatDateTime(n.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {completed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Completed orders</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {completed.map((o) => (
                <li key={o._id.toString()} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium">{o.productSnapshot.name}</p>
                    <p className="text-[12.5px] text-muted">{o.orderNumber} · completed {formatDate(o.completedAt)}</p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/account/orders/${o._id}/statement`}>Statement</Link>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

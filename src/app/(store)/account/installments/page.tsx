import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { InstallmentTable } from "@/components/account/installment-table";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState, PageHeader, StatCard } from "@/components/ui/primitives";
import { deriveInstallmentStatus } from "@/lib/allocation";
import { formatDate } from "@/lib/dates";
import { formatGHS } from "@/lib/money";
import { serialize } from "@/lib/utils";
import { Installment, Order } from "@/models";
import { requireCustomerPage } from "@/server/auth/session";

export const metadata: Metadata = { title: "Repayment schedule" };

export default async function InstallmentsPage() {
  const actor = await requireCustomerPage("/account/installments");
  const order = (await Order.findOne({ customerId: actor.userId, isActive: true }).lean()) ?? (await Order.findOne({ customerId: actor.userId, depositPaidAt: { $ne: null } }).sort({ createdAt: -1 }).lean());
  if (!order) {
    return (
      <div>
        <PageHeader title="Repayment schedule" />
        <EmptyState icon={<CalendarDays />} title="No schedule yet" description="Your repayment schedule appears here once your deposit is confirmed." action={<Button asChild><Link href="/shop">Browse iPhones</Link></Button>} />
      </div>
    );
  }
  const rows = await Installment.find({ orderId: order._id }).sort({ installmentNumber: 1 }).lean();
  const now = new Date();
  const grace = order.planSnapshot.gracePeriodDays;
  const overdue = rows.filter((r) => deriveInstallmentStatus(r, now, grace) === "overdue").reduce((a, r) => a + r.outstandingAmount, 0);
  return (
    <div>
      <PageHeader
        title="Repayment schedule"
        description={`${order.productSnapshot.name} · ${order.orderNumber} · ${order.planSnapshot.name}`}
        actions={order.outstandingBalance > 0 ? <Button asChild><Link href={`/account/orders/${order._id}#pay`}>Make a payment</Link></Button> : undefined}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Overall outstanding" value={formatGHS(order.outstandingBalance)} />
        <StatCard label="Next payment" value={order.nextDueAmount && order.outstandingBalance ? formatGHS(order.nextDueAmount) : "—"} hint={order.nextDueDate && order.outstandingBalance ? `Due ${formatDate(order.nextDueDate)}` : undefined} />
        <StatCard label="Overdue" value={formatGHS(overdue)} tone={overdue > 0 ? "danger" : "default"} hint={overdue > 0 ? "Please pay or contact us" : "Nothing overdue"} />
      </div>
      {overdue > 0 && (
        <Alert tone="warning" className="mb-4" title="You have an overdue installment">
          Pay any amount towards it from your order page, or contact support if you need help — we&apos;re happy to talk it through.
        </Alert>
      )}
      {rows.length ? (
        <InstallmentTable rows={serialize(rows) as never} graceDays={grace} />
      ) : (
        <Alert tone="info">Your schedule will be generated when your deposit is confirmed.</Alert>
      )}
      <p className="mt-4 text-[12.5px] text-muted">
        Payments settle your oldest outstanding installment first. Original amounts are shown as scheduled; payments are recorded against each installment.
      </p>
    </div>
  );
}

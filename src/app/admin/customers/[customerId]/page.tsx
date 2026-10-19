import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { accountStatusAction, reviewVerificationAction } from "@/app/actions/admin";
import { ActionButton } from "@/components/admin/action-button";
import { NoteForm } from "@/components/admin/note-form";
import { InstallmentStatusBadge, OrderStatusBadge, PaymentStatusBadge, SandboxBadge } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { Card, CardContent, StatCard } from "@/components/ui/primitives";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { deriveInstallmentStatus } from "@/lib/allocation";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatGHS } from "@/lib/money";
import { hasPermission } from "@/lib/permissions";
import { AuditLog, Installment } from "@/models";
import { requireStaffPage } from "@/server/auth/session";
import { getCustomerDetail } from "@/server/services/customers";

export const metadata = { title: "Customer" };

export default async function CustomerDetail({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;
  const actor = await requireStaffPage("customers.view", `/admin/customers/${customerId}`);
  const data = await getCustomerDetail(actor, customerId).catch(() => null);
  if (!data) notFound();
  const { user, orders, payments, verifications, notes } = data;
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(actor.role, p);
  const [installments, activity] = await Promise.all([
    Installment.find({ customerId }).sort({ dueDate: 1 }).limit(200).lean(),
    AuditLog.find({ $or: [{ resourceType: "User", resourceId: customerId }, { resourceId: { $in: orders.map((o) => o._id.toString()) } }] }).sort({ timestamp: -1 }).limit(50).populate("actorId", "name").lean(),
  ]);
  const grace = new Map(orders.map((o) => [o._id.toString(), o.planSnapshot.gracePeriodDays]));
  const now = new Date();
  const totalPaid = orders.reduce((a, o) => a + o.amountPaid, 0);
  const outstanding = orders.filter((o) => o.isActive).reduce((a, o) => a + o.outstandingBalance, 0);
  const overdue = installments.filter((i) => deriveInstallmentStatus(i, now, grace.get(i.orderId.toString()) ?? 0) === "overdue").reduce((a, i) => a + i.outstandingAmount, 0);

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[13px] text-muted">
        <Link href="/admin/customers" className="hover:text-foreground">Customers</Link><ChevronRight className="size-3.5" /><span className="text-foreground">{user.name}</span>
      </nav>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
          <p className="text-sm text-muted">{user.email} · {user.phone} · joined {formatDate(user.createdAt)}</p>
          <div className="mt-2 flex gap-2">
            <Badge tone={user.verificationStatus === "verified" ? "success" : user.verificationStatus === "pending" ? "warning" : "grey"} dot>{user.verificationStatus}</Badge>
            <Badge tone={user.accountStatus === "active" ? "success" : "danger"}>{user.accountStatus}</Badge>
          </div>
        </div>
        {can("customers.suspend") && (
          user.accountStatus === "active" ? (
            <ActionButton danger label="Suspend account" action={accountStatusAction.bind(null, customerId, "suspended")} reason="required" confirm={{ title: "Suspend this account?", description: "The customer will be signed out and unable to log in." }} />
          ) : (
            <ActionButton label="Reactivate account" action={accountStatusAction.bind(null, customerId, "active")} reason="required" confirm={{ title: "Reactivate account" }} />
          )
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Orders" value={orders.length} hint={`${orders.filter((o) => o.orderStatus === "completed").length} completed`} />
        <StatCard label="Total confirmed paid" value={formatGHS(totalPaid)} />
        <StatCard label="Outstanding" value={formatGHS(outstanding)} />
        <StatCard label="Overdue" value={formatGHS(overdue)} tone={overdue ? "danger" : "default"} />
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          {["profile", "orders", "payments", "installments", "verification", "activity"].map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">{t}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="profile">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card><CardContent className="space-y-1.5 text-sm">
              {[["Name", user.name], ["Email", user.email], ["Phone", user.phone], ["Email notifications", user.notificationPreferences.email ? "On" : "Off"], ["SMS notifications", user.notificationPreferences.sms ? "On" : "Off"], ["Marketing consent", user.consents.marketingConsentAt ? formatDate(user.consents.marketingConsentAt) : "No"], ["Terms version", user.consents.termsVersion], ["Last login", formatDateTime(user.lastLoginAt)]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3"><span className="text-muted">{k}</span><span className="font-medium">{v}</span></div>
              ))}
              {user.masked && <p className="pt-2 text-[12px] text-muted">Contact details masked for your role.</p>}
            </CardContent></Card>
            <Card><CardContent className="space-y-4">
              <h3 className="text-sm font-semibold">Internal notes</h3>
              {can("customers.notes") && <NoteForm customerId={customerId} />}
              <ul className="space-y-3">
                {notes.map((n) => (
                  <li key={n._id.toString()} className="rounded-[12px] bg-surface-2 p-3 text-sm">
                    <p>{n.body}</p>
                    <p className="mt-1 text-[12px] text-muted">{(n.authorId as unknown as { name?: string })?.name} · {formatDateTime(n.createdAt)}</p>
                  </li>
                ))}
                {notes.length === 0 && <p className="text-sm text-muted">No notes yet.</p>}
              </ul>
            </CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="orders">
          <Table>
            <THead><tr><TH>Order</TH><TH>Product</TH><TH>Applied</TH><TH className="text-right">Contract</TH><TH className="text-right">Paid</TH><TH className="text-right">Outstanding</TH><TH>Status</TH></tr></THead>
            <TBody>
              {orders.map((o) => (
                <TR key={o._id.toString()}>
                  <TD><Link className="text-accent hover:underline" href={`/admin/orders/${o._id}`}>{o.orderNumber}</Link></TD>
                  <TD>{o.productSnapshot.name}</TD><TD>{formatDate(o.createdAt)}</TD>
                  <TD className="tabular text-right">{formatGHS(o.agreedPurchasePrice)}</TD><TD className="tabular text-right">{formatGHS(o.amountPaid)}</TD><TD className="tabular text-right">{formatGHS(o.outstandingBalance)}</TD>
                  <TD><OrderStatusBadge status={o.orderStatus} /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TabsContent>

        <TabsContent value="payments">
          {!can("payments.view") ? <p className="text-sm text-muted">Your role cannot view payment records.</p> : (
            <Table>
              <THead><tr><TH>Reference</TH><TH>Date</TH><TH>Order</TH><TH>Type</TH><TH className="text-right">Amount</TH><TH>Status</TH></tr></THead>
              <TBody>
                {payments.map((p) => (
                  <TR key={p.reference}>
                    <TD><Link className="font-mono text-[12px] text-accent hover:underline" href={`/admin/payments/${p._id}`}>{p.reference}</Link> {p.isTest && <SandboxBadge />}</TD>
                    <TD>{formatDateTime(p.createdAt)}</TD><TD>{p.orderNumber}</TD><TD className="capitalize">{p.kind.replace("_", " ")}</TD>
                    <TD className="tabular text-right">{formatGHS(p.amount)}</TD><TD><PaymentStatusBadge status={p.status} /></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="installments">
          <Table>
            <THead><tr><TH>Order</TH><TH>#</TH><TH>Due</TH><TH className="text-right">Due amount</TH><TH className="text-right">Paid</TH><TH>Status</TH></tr></THead>
            <TBody>
              {installments.map((i) => (
                <TR key={i._id.toString()}>
                  <TD>{i.orderNumber}</TD><TD>{i.installmentNumber}</TD><TD>{formatDate(i.dueDate)}</TD>
                  <TD className="tabular text-right">{formatGHS(i.amountDue)}</TD><TD className="tabular text-right">{formatGHS(i.amountPaid)}</TD>
                  <TD><InstallmentStatusBadge status={i.status === "cancelled" ? "cancelled" : deriveInstallmentStatus(i, now, grace.get(i.orderId.toString()) ?? 0)} /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TabsContent>

        <TabsContent value="verification">
          <div className="space-y-3">
            {verifications.length === 0 && <p className="text-sm text-muted">No verification submitted.</p>}
            {verifications.map((v) => (
              <Card key={v._id.toString()}><CardContent className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="text-sm">
                  <p className="font-medium capitalize">{v.documentType.replace("_", " ")} ending <span className="font-mono">{v.idLast4}</span></p>
                  <p className="text-muted">Submitted {formatDateTime(v.createdAt)} · DOB {formatDate(v.dateOfBirth)} · method {v.method.replace("_", " ")}</p>
                  {v.reviewNote && <p className="text-muted">Note: {v.reviewNote}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={v.status === "verified" ? "success" : v.status === "pending" ? "warning" : "danger"}>{v.status}</Badge>
                  {can("customers.verify") && v.status === "pending" && (
                    <>
                      <ActionButton variant="primary" label="Verify" action={reviewVerificationAction.bind(null, v._id.toString(), "verified")} confirm={{ title: "Confirm identity verified", description: "Only confirm after checking the original document in person or through an authorised verification provider." }} reason="optional" reasonLabel="Note" />
                      <ActionButton danger label="Reject" action={reviewVerificationAction.bind(null, v._id.toString(), "rejected")} reason="required" confirm={{ title: "Reject verification" }} />
                    </>
                  )}
                </div>
              </CardContent></Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <ul className="space-y-2 text-sm">
            {activity.map((a) => (
              <li key={a._id.toString()} className="rounded-[10px] border border-border bg-surface px-3 py-2">
                <span className="font-medium">{a.action}</span> · {(a.actorId as unknown as { name?: string })?.name ?? "System / customer"} · <span className="text-muted">{formatDateTime(a.timestamp)}</span>
                {a.reason && <span className="text-muted"> — {a.reason}</span>}
              </li>
            ))}
            {activity.length === 0 && <p className="text-muted">No activity recorded.</p>}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}

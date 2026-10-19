import { contactHandledAction } from "@/app/actions/admin";
import { ActionButton } from "@/components/admin/action-button";
import { Pager } from "@/components/admin/list-controls";
import { TemplateEditor } from "@/components/admin/template-editor";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { Card, CardContent, PageHeader, StatCard } from "@/components/ui/primitives";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { hasPermission } from "@/lib/permissions";
import { ContactMessage, Notification, NotificationTemplate, User } from "@/models";
import { NOTIFICATION_TEMPLATES } from "@/models/Notification";
import { requireStaffPage } from "@/server/auth/session";
import { DEFAULT_TEMPLATES } from "@/server/notifications/templates";

export const metadata = { title: "Notifications" };

export default async function NotificationsAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireStaffPage("customers.view", "/admin/notifications");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const f: Record<string, unknown> = { channel: { $in: ["email", "sms"] } };
  if (sp.status) f.deliveryStatus = sp.status;
  const [log, total, overrides, inbox, counts] = await Promise.all([
    Notification.find(f).sort({ createdAt: -1 }).skip((page - 1) * 30).limit(30).lean(),
    Notification.countDocuments(f),
    NotificationTemplate.find().lean(),
    ContactMessage.find().sort({ status: 1, createdAt: -1 }).limit(50).lean(),
    Notification.aggregate([{ $match: { channel: { $in: ["email", "sms"] }, createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } } }, { $group: { _id: "$deliveryStatus", n: { $sum: 1 } } }]),
  ]);
  const users = new Map((await User.find({ _id: { $in: log.map((l) => l.userId) } }).select("name").lean()).map((u) => [u._id.toString(), u.name]));
  const c = (s: string) => counts.find((x) => x._id === s)?.n ?? 0;
  const canTemplates = hasPermission(actor.role, "notifications.manage");

  return (
    <div>
      <PageHeader title="Notifications" description="Delivery log, message templates and the contact inbox." />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatCard label="Sent (30 days)" value={c("sent")} tone="success" />
        <StatCard label="Failed" value={c("failed")} tone={c("failed") ? "danger" : "default"} />
        <StatCard label="Skipped (not configured)" value={c("skipped")} />
        <StatCard label="New messages" value={inbox.filter((m) => m.status === "new").length} />
      </div>
      <Tabs defaultValue="log">
        <TabsList>
          <TabsTrigger value="log">Delivery log</TabsTrigger>
          {canTemplates && <TabsTrigger value="templates">Templates</TabsTrigger>}
          <TabsTrigger value="inbox">Contact inbox</TabsTrigger>
        </TabsList>
        <TabsContent value="log">
          <Table>
            <THead><tr><TH>Time</TH><TH>Customer</TH><TH>Channel</TH><TH>Template</TH><TH>Subject</TH><TH>Provider</TH><TH>Status</TH></tr></THead>
            <TBody>
              {log.length === 0 && <tr><TD colSpan={7} className="py-8 text-center text-muted">Nothing sent yet.</TD></tr>}
              {log.map((n) => (
                <TR key={n._id.toString()}>
                  <TD className="text-muted">{formatDateTime(n.createdAt)}</TD>
                  <TD>{users.get(n.userId.toString())}</TD>
                  <TD className="uppercase">{n.channel}</TD>
                  <TD className="font-mono text-[12px]">{n.template}</TD>
                  <TD className="max-w-xs truncate">{n.subject}</TD>
                  <TD>{n.provider ?? "—"}</TD>
                  <TD><Badge tone={n.deliveryStatus === "sent" ? "success" : n.deliveryStatus === "failed" ? "danger" : "grey"} title={n.error ?? undefined}>{n.deliveryStatus}</Badge></TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pager page={page} pageSize={30} total={total} params={sp} />
        </TabsContent>
        {canTemplates && (
          <TabsContent value="templates">
            <p className="mb-4 text-sm text-muted">Keep messages factual and respectful. Never threaten customers or mention their balance to anyone else.</p>
            <div className="space-y-2">
              {NOTIFICATION_TEMPLATES.map((k) => {
                const o = overrides.find((x) => x.key === k);
                const d = DEFAULT_TEMPLATES[k];
                return <TemplateEditor key={k} k={k} initial={{ subject: o?.subject ?? d.subject, body: o?.body ?? d.body, smsBody: o?.smsBody ?? d.smsBody, enabled: o?.enabled ?? true }} />;
              })}
            </div>
          </TabsContent>
        )}
        <TabsContent value="inbox">
          <div className="space-y-3">
            {inbox.length === 0 && <p className="text-sm text-muted">No messages.</p>}
            {inbox.map((m) => (
              <Card key={m._id.toString()}>
                <CardContent className="flex flex-col justify-between gap-3 sm:flex-row">
                  <div className="text-sm">
                    <p className="font-medium">{m.subject} {m.status === "new" && <Badge tone="accent">New</Badge>}</p>
                    <p className="text-muted">{m.name} · {m.email}{m.phone ? ` · ${m.phone}` : ""} · {formatDateTime(m.createdAt)}</p>
                    <p className="mt-2 whitespace-pre-line">{m.message}</p>
                  </div>
                  {m.status === "new" && hasPermission(actor.role, "customers.notes") && <ActionButton label="Mark handled" action={contactHandledAction.bind(null, m._id.toString())} />}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

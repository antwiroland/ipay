import { staffStatusAction } from "@/app/actions/admin";
import { ActionButton } from "@/components/admin/action-button";
import { CreateStaffDialog, RoleSelect } from "@/components/admin/staff-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui/primitives";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { ROLE_LABEL, ROLE_PERMISSIONS, STAFF_ROLES } from "@/lib/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { listStaff } from "@/server/services/customers";

export const metadata = { title: "Staff & roles" };

export default async function StaffPage() {
  const actor = await requireStaffPage("staff.manage", "/admin/staff");
  const staff = await listStaff(actor);
  return (
    <div className="space-y-6">
      <PageHeader title="Staff & roles" description="Least-privilege access. Every role change is audited and signs the user out." actions={<CreateStaffDialog />} />
      <Table>
        <THead><tr><TH>Name</TH><TH>Email</TH><TH>Role</TH><TH>2FA</TH><TH>Last login</TH><TH>Status</TH><TH /></tr></THead>
        <TBody>
          {staff.map((s) => {
            const self = s._id.toString() === actor.userId;
            return (
              <TR key={s._id.toString()}>
                <TD className="font-medium">{s.name}{self && <span className="text-muted"> (you)</span>}</TD>
                <TD>{s.email}</TD>
                <TD><RoleSelect userId={s._id.toString()} role={s.role} disabled={self} /></TD>
                <TD>{s.mfa?.enabled ? <Badge tone="success">On</Badge> : <Badge tone="warning">Off</Badge>}</TD>
                <TD className="text-muted">{formatDateTime(s.lastLoginAt)}</TD>
                <TD><Badge tone={s.accountStatus === "active" ? "success" : "danger"}>{s.accountStatus}</Badge></TD>
                <TD>
                  {!self && (s.accountStatus === "active" ? (
                    <ActionButton danger label="Suspend" action={staffStatusAction.bind(null, s._id.toString(), "suspended")} reason="required" confirm={{ title: `Suspend ${s.name}?` }} />
                  ) : (
                    <ActionButton label="Reactivate" action={staffStatusAction.bind(null, s._id.toString(), "active")} reason="required" confirm={{ title: `Reactivate ${s.name}?` }} />
                  ))}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
      <Card>
        <CardHeader><CardTitle>Role permissions</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {STAFF_ROLES.map((r) => (
            <div key={r} className="rounded-[12px] border border-border p-3">
              <p className="font-medium">{ROLE_LABEL[r]}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">{ROLE_PERMISSIONS[r].join(" · ")}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

import { ShieldCheck } from "lucide-react";
import { MfaSetup } from "@/components/admin/mfa-setup";
import { Alert, Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from "@/components/ui/primitives";
import { User } from "@/models";
import { requireStaffPage } from "@/server/auth/session";

export const metadata = { title: "My security" };

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ required?: string }> }) {
  const actor = await requireStaffPage("admin.access", "/admin/security");
  const sp = await searchParams;
  const user = await User.findById(actor.userId).lean();
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="My security" />
      {sp.required && !user?.mfa?.enabled && <Alert tone="warning" title="Two-factor authentication is required">Your administrator requires 2FA for all staff. Set it up to continue.</Alert>}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4" /> Two-factor authentication</CardTitle>
          <CardDescription>Protects financial actions if your password is ever compromised.</CardDescription>
        </CardHeader>
        <CardContent>{user?.mfa?.enabled ? <Alert tone="success">Two-factor authentication is on for your account.</Alert> : <MfaSetup />}</CardContent>
      </Card>
    </div>
  );
}

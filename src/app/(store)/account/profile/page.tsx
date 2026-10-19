import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { PasswordForm, ProfileForm, VerificationForm } from "@/components/account/profile-forms";
import { Badge } from "@/components/ui/badge";
import { Alert, Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from "@/components/ui/primitives";
import { formatDate } from "@/lib/dates";
import { safeInternalPath } from "@/lib/validation";
import { IdentityVerification, User } from "@/models";
import { requireCustomerPage } from "@/server/auth/session";

export const metadata: Metadata = { title: "Profile & settings" };

const VERIFY_TONE = { unverified: "grey", pending: "warning", verified: "success", rejected: "danger" } as const;

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ verify?: string; next?: string }> }) {
  const actor = await requireCustomerPage("/account/profile");
  const sp = await searchParams;
  const [user, latest] = await Promise.all([
    User.findById(actor.userId).lean(),
    IdentityVerification.findOne({ userId: actor.userId }).sort({ createdAt: -1 }).lean(),
  ]);
  if (!user) return null;
  return (
    <div className="space-y-6">
      <PageHeader title="Profile & settings" description={`Member since ${formatDate(user.createdAt)}`} />

      <Card id="verify">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4" /> Identity verification</CardTitle>
            <Badge tone={VERIFY_TONE[user.verificationStatus]} dot>{user.verificationStatus}</Badge>
          </div>
          <CardDescription>Required for Take & Pay plans. We store only your ID type and the last 4 characters — never a copy of your ID.</CardDescription>
        </CardHeader>
        <CardContent>
          {user.verificationStatus === "verified" ? (
            <Alert tone="success">Your identity is verified{latest ? ` (${latest.documentType.replace("_", " ")} ending ${latest.idLast4})` : ""}.</Alert>
          ) : user.verificationStatus === "pending" ? (
            <Alert tone="info" title="Submitted — awaiting review">
              {latest ? `${latest.documentType.replace("_", " ")} ending ${latest.idLast4}, submitted ${formatDate(latest.createdAt)}. ` : ""}
              You can already apply for a plan; approval completes once staff confirm your original ID in store.
            </Alert>
          ) : (
            <div className="space-y-4">
              {user.verificationStatus === "rejected" && latest?.reviewNote && <Alert tone="danger" title="Previous submission not approved">{latest.reviewNote}</Alert>}
              {sp.verify && <Alert tone="info">Submit your ID details to continue with your selected plan.</Alert>}
              <VerificationForm next={sp.next ? safeInternalPath(sp.next, "/shop") : undefined} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            initial={{
              name: user.name,
              email: user.email,
              phone: user.phone,
              emailNotifications: user.notificationPreferences.email,
              smsNotifications: user.notificationPreferences.sms,
              marketing: user.notificationPreferences.marketing,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Changing your password signs you out on other devices.</CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted">
          <p>Status: <span className="font-medium text-foreground capitalize">{user.accountStatus}</span></p>
          <p>Terms accepted: version {user.consents.termsVersion} on {formatDate(user.consents.termsAcceptedAt)}</p>
          <p>Marketing consent: {user.consents.marketingConsentAt ? `given ${formatDate(user.consents.marketingConsentAt)}` : "not given"}</p>
        </CardContent>
      </Card>
    </div>
  );
}

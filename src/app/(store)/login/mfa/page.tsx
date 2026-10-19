import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { MfaForm } from "@/components/auth/forms";
import { safeInternalPath } from "@/lib/validation";
import { getCurrentSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Two-factor verification" };

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const s = await getCurrentSession();
  if (!s) redirect("/login");
  if (!s.user.mfa?.enabled || s.session.mfaVerified) redirect(safeInternalPath(sp.next, "/admin"));
  return (
    <AuthShell title="Two-factor verification" subtitle="Enter the 6-digit code from your authenticator app.">
      <MfaForm next={safeInternalPath(sp.next, "/admin")} />
    </AuthShell>
  );
}

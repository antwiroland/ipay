import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/forms";
import { safeInternalPath } from "@/lib/validation";
import { getActor } from "@/server/auth/session";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const sp = await searchParams;
  const next = safeInternalPath(sp.next, "");
  if (await getActor().catch(() => null)) redirect(next || "/account");
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to track your plan and make payments."
      footer={<>New to iPay Ghana? <Link className="font-medium text-accent hover:underline" href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Create an account</Link></>}
    >
      <LoginForm next={next || undefined} notice={sp.reset ? "Your password was reset. Log in with your new password." : undefined} />
    </AuthShell>
  );
}

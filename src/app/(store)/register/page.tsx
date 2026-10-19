import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/forms";
import { safeInternalPath } from "@/lib/validation";
import { getActor } from "@/server/auth/session";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = safeInternalPath(sp.next, "");
  if (await getActor().catch(() => null)) redirect(next || "/account");
  return (
    <AuthShell
      title="Create your account"
      subtitle="It takes about a minute. We only ask for what we need."
      footer={<>Already have an account? <Link className="font-medium text-accent hover:underline" href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Log in</Link></>}
    >
      <RegisterForm next={next || undefined} />
    </AuthShell>
  );
}

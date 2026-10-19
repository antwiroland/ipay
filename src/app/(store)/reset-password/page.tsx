import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetForm } from "@/components/auth/forms";
import { Alert } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Choose a new password", referrer: "no-referrer" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthShell title="Choose a new password" subtitle="You'll be signed out of all other devices.">
      {token && token.length >= 20 ? (
        <ResetForm token={token} />
      ) : (
        <Alert tone="danger" title="This link is incomplete">
          Request a new link from the <Link className="underline" href="/forgot-password">forgot password</Link> page.
        </Alert>
      )}
    </AuthShell>
  );
}

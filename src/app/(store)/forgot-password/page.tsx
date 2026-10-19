import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPage() {
  return (
    <AuthShell title="Reset your password" subtitle="Enter your email and we'll send you a secure link." footer={<Link className="font-medium text-accent hover:underline" href="/login">Back to log in</Link>}>
      <ForgotForm />
    </AuthShell>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, type FieldValues, type Path, type UseFormSetError } from "react-hook-form";
import { z } from "zod";
import { forgotPasswordAction, loginAction, mfaAction, registerAction, resetPasswordAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input } from "@/components/ui/primitives";

/** Copy server-side field errors onto react-hook-form fields. */
export function applyFieldErrors<T extends FieldValues>(setError: UseFormSetError<T>, fieldErrors?: Record<string, string[]>) {
  for (const [k, v] of Object.entries(fieldErrors ?? {})) setError(k as Path<T>, { message: v[0] });
}

function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className="pr-10" />
      <button type="button" className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted hover:text-foreground" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

/* ---------------- Login ---------------- */
const loginClient = z.object({ email: z.string().trim().email("Enter a valid email"), password: z.string().min(1, "Enter your password") });

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof loginClient>>({ resolver: zodResolver(loginClient) });
  const onSubmit = form.handleSubmit((values) =>
    start(async () => {
      setError(null);
      const r = await loginAction(values, next);
      if (r.ok) {
        router.push(r.data.redirectTo);
        router.refresh();
      } else setError(r.error);
    }),
  );
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!form.formState.errors.email} {...form.register("email")} />
      </Field>
      <Field label="Password" htmlFor="password" error={form.formState.errors.password?.message}>
        <PasswordInput id="password" autoComplete="current-password" aria-invalid={!!form.formState.errors.password} {...form.register("password")} />
      </Field>
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-[13px] font-medium text-accent hover:underline">Forgot password?</Link>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={pending}>Log in</Button>
    </form>
  );
}

/* ---------------- Register ---------------- */
const registerClient = z
  .object({
    name: z.string().trim().min(2, "Enter your full name"),
    email: z.string().trim().email("Enter a valid email address"),
    phone: z.string().trim().min(9, "Enter your phone number"),
    password: z.string().min(10, "Use at least 10 characters").refine((v) => /[a-z]/i.test(v) && /\d/.test(v), "Include a letter and a number"),
    confirmPassword: z.string(),
    acceptTerms: z.boolean().refine((v) => v, "You must accept the terms and privacy policy"),
    marketingConsent: z.boolean().optional(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

export function RegisterForm({ next }: { next?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof registerClient>>({ resolver: zodResolver(registerClient), defaultValues: { acceptTerms: false, marketingConsent: false } });
  const e = form.formState.errors;
  const onSubmit = form.handleSubmit((values) =>
    start(async () => {
      setError(null);
      const r = await registerAction(values, next);
      if (r.ok) {
        router.push(r.data.redirectTo);
        router.refresh();
      } else {
        setError(r.error);
        applyFieldErrors(form.setError, r.fieldErrors);
      }
    }),
  );
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Full name" htmlFor="name" error={e.name?.message}>
        <Input id="name" autoComplete="name" aria-invalid={!!e.name} {...form.register("name")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" htmlFor="email" error={e.email?.message}>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!e.email} {...form.register("email")} />
        </Field>
        <Field label="Phone number" htmlFor="phone" error={e.phone?.message} hint="Used for payment and plan alerts">
          <Input id="phone" type="tel" autoComplete="tel" placeholder="024 123 4567" aria-invalid={!!e.phone} {...form.register("phone")} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Password" htmlFor="password" error={e.password?.message} hint="10+ characters with a letter and a number">
          <PasswordInput id="password" autoComplete="new-password" aria-invalid={!!e.password} {...form.register("password")} />
        </Field>
        <Field label="Confirm password" htmlFor="confirmPassword" error={e.confirmPassword?.message}>
          <PasswordInput id="confirmPassword" autoComplete="new-password" aria-invalid={!!e.confirmPassword} {...form.register("confirmPassword")} />
        </Field>
      </div>
      <div className="space-y-2.5 pt-1 text-[13.5px]">
        <label className="flex items-start gap-2.5">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--foreground)]" {...form.register("acceptTerms")} />
          <span>
            I agree to the <Link href="/terms" target="_blank" className="font-medium text-accent hover:underline">Terms</Link> and{" "}
            <Link href="/privacy" target="_blank" className="font-medium text-accent hover:underline">Privacy Policy</Link>.
          </span>
        </label>
        {e.acceptTerms && <p className="text-[12.5px] text-danger">{e.acceptTerms.message}</p>}
        <label className="flex items-start gap-2.5 text-muted">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--foreground)]" {...form.register("marketingConsent")} />
          Send me offers and new arrivals (optional).
        </label>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={pending}>Create account</Button>
    </form>
  );
}

/* ---------------- Forgot / reset ---------------- */
export function ForgotForm() {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  if (done) return <Alert tone="success" icon={<MailCheck />} title="Check your email">{done}</Alert>;
  return (
    <form
      className="space-y-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        start(async () => {
          const r = await forgotPasswordAction(email);
          if (r.ok) setDone(r.message ?? "Check your inbox.");
          else setError(r.error);
        });
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Email" htmlFor="email">
        <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>Send reset link</Button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const schema = z
    .object({ password: registerClient.shape.password, confirmPassword: z.string() })
    .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const e = form.formState.errors;
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={form.handleSubmit((v) =>
        start(async () => {
          const r = await resetPasswordAction({ ...v, token });
          if (r.ok) router.push(r.data.redirectTo);
          else setError(r.error);
        }),
      )}
    >
      {error && <Alert tone="danger">{error} <Link className="underline" href="/forgot-password">Request a new link</Link></Alert>}
      <Field label="New password" htmlFor="password" error={e.password?.message}>
        <PasswordInput id="password" autoComplete="new-password" {...form.register("password")} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirmPassword" error={e.confirmPassword?.message}>
        <PasswordInput id="confirmPassword" autoComplete="new-password" {...form.register("confirmPassword")} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>Reset password</Button>
    </form>
  );
}

export function MfaForm({ next }: { next?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        start(async () => {
          const r = await mfaAction(code, next);
          if (r.ok) {
            router.push(r.data.redirectTo);
            router.refresh();
          } else setError(r.error);
        });
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="6-digit code" htmlFor="code">
        <Input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="tabular text-center text-lg tracking-[0.4em]" />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending} disabled={code.length !== 6}>Verify</Button>
    </form>
  );
}

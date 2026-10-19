"use server";

import { isStaffRole } from "@/lib/permissions";
import { safeInternalPath } from "@/lib/validation";
import { actorOrThrow, appUrl, run } from "@/server/action";
import { clearSessionCookie, getSessionToken, requestMeta, setSessionCookie } from "@/server/auth/session";
import { connectDB } from "@/server/db";
import { rateLimit } from "@/server/rate-limit";
import * as auth from "@/server/services/auth";
import { submitVerification } from "@/server/services/customers";

export async function registerAction(input: unknown, next?: string) {
  return run(async () => {
    const meta = await requestMeta();
    await rateLimit("register", meta.ip ?? "unknown", 10, 3600);
    const user = await auth.registerCustomer(input);
    const { token, expiresAt } = await auth.createSession(user, meta, true);
    await setSessionCookie(token, expiresAt);
    return { redirectTo: safeInternalPath(next, "/account") };
  });
}

export async function loginAction(input: { email?: string; password?: string }, next?: string) {
  return run(async () => {
    const meta = await requestMeta();
    await rateLimit("login:ip", meta.ip ?? "unknown", 30, 900);
    await rateLimit("login:email", String(input?.email ?? "").toLowerCase().slice(0, 254), 8, 900);
    await connectDB();
    const { user, mfaRequired } = await auth.authenticate(input);
    const { token, expiresAt } = await auth.createSession(user, meta, !mfaRequired);
    await setSessionCookie(token, expiresAt);
    const fallback = isStaffRole(user.role) ? "/admin" : "/account";
    const dest = safeInternalPath(next, fallback);
    if (mfaRequired) return { redirectTo: `/login/mfa?next=${encodeURIComponent(dest)}` };
    // Staff are never sent to customer pages, and vice versa.
    if (isStaffRole(user.role) && dest.startsWith("/account")) return { redirectTo: "/admin" };
    if (!isStaffRole(user.role) && dest.startsWith("/admin")) return { redirectTo: "/account" };
    return { redirectTo: dest };
  });
}

export async function mfaAction(code: string, next?: string) {
  return run(async () => {
    const token = await getSessionToken();
    const meta = await requestMeta();
    await rateLimit("mfa", meta.ip ?? "unknown", 10, 600);
    if (!token) throw new Error("No session");
    await auth.verifySessionMfa(token, String(code ?? ""));
    return { redirectTo: safeInternalPath(next, "/admin") };
  });
}

/** Deletes the server-side session and the cookie. The client then reloads (see components/logout-button). */
export async function logoutAction() {
  const token = await getSessionToken();
  await auth.destroySession(token);
  await clearSessionCookie();
  return { ok: true as const };
}

export async function forgotPasswordAction(email: string) {
  return run(async () => {
    const meta = await requestMeta();
    await rateLimit("forgot", meta.ip ?? "unknown", 5, 900);
    await auth.requestPasswordReset(String(email ?? ""), appUrl());
    return null;
  }, "If an account exists for that email, we've sent a reset link.");
}

export async function resetPasswordAction(input: unknown) {
  return run(async () => {
    const meta = await requestMeta();
    await rateLimit("reset", meta.ip ?? "unknown", 10, 900);
    await auth.resetPassword(input);
    await clearSessionCookie();
    return { redirectTo: "/login?reset=1" };
  });
}

export async function updateProfileAction(input: unknown, currentPassword?: string) {
  return run(async () => {
    const actor = await actorOrThrow();
    await auth.updateProfile(actor, input, currentPassword);
    return null;
  }, "Profile updated.");
}

export async function changePasswordAction(current: string, next: string) {
  return run(async () => {
    const actor = await actorOrThrow();
    await rateLimit("change-password", actor.userId, 10, 900);
    await auth.changePassword(actor, current, next);
    // Re-issue a session for this device; all others were invalidated.
    const user = { _id: actor.userId as never, role: actor.role };
    const { token, expiresAt } = await auth.createSession(user, await requestMeta(), true);
    await setSessionCookie(token, expiresAt);
    return null;
  }, "Password changed. Other devices have been signed out.");
}

export async function submitVerificationAction(input: unknown) {
  return run(async () => {
    const actor = await actorOrThrow();
    await rateLimit("verification", actor.userId, 5, 3600);
    await submitVerification(actor, input);
    return null;
  }, "Thanks — your details were submitted for review. Bring the original ID when you visit a store.");
}

export async function beginMfaAction() {
  return run(async () => {
    const actor = await actorOrThrow();
    const secret = await auth.beginMfaEnrolment(actor);
    const { totpUri } = await import("@/server/auth/crypto");
    return { secret, uri: totpUri(secret, actor.email) };
  });
}

export async function confirmMfaAction(code: string) {
  return run(async () => {
    const actor = await actorOrThrow();
    await auth.confirmMfaEnrolment(actor, code);
    // Current session counts as verified (user just proved possession).
    const token = await getSessionToken();
    if (token) await auth.verifySessionMfa(token, code).catch(() => undefined);
    return null;
  }, "Two-factor authentication is on.");
}

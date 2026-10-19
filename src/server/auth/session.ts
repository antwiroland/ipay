import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { hasPermission, isStaffRole, type Permission } from "@/lib/permissions";
import { Setting } from "@/models";
import { resolveSession } from "../services/auth";
import type { Actor } from "./actor";

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-ipay_session" : "ipay_session";

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  // Expire with the same attributes it was set with (required for __Host- cookies).
  (await cookies()).set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

export async function requestMeta() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || null;
  return { ip, userAgent: h.get("user-agent") };
}

/** Cached per request. */
export const getCurrentSession = cache(async () => {
  const token = await getSessionToken();
  const resolved = await resolveSession(token);
  if (!resolved) return null;
  const { ip } = await requestMeta();
  resolved.actor.ip = ip;
  return resolved;
});

export async function getActor(): Promise<Actor | null> {
  const s = await getCurrentSession();
  if (!s) return null;
  // Staff with MFA enabled must complete the second factor before acting.
  if (s.user.mfa?.enabled && !s.session.mfaVerified) return null;
  return s.actor;
}

/** For pages: redirect to login when signed out. */
export async function requireUserPage(returnTo: string): Promise<Actor> {
  const s = await getCurrentSession();
  if (!s) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (s.user.mfa?.enabled && !s.session.mfaVerified) redirect(`/login/mfa?next=${encodeURIComponent(returnTo)}`);
  return s.actor;
}

export async function requireCustomerPage(returnTo: string): Promise<Actor> {
  const actor = await requireUserPage(returnTo);
  if (isStaffRole(actor.role)) redirect("/admin");
  return actor;
}

export async function requireStaffPage(permission: Permission = "admin.access", returnTo = "/admin", opts: { enforceMfaPolicy?: boolean } = {}): Promise<Actor> {
  const s = await getCurrentSession();
  if (!s) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (!isStaffRole(s.actor.role)) redirect("/account");
  if (s.user.mfa?.enabled && !s.session.mfaVerified) redirect(`/login/mfa?next=${encodeURIComponent(returnTo)}`);
  if (opts.enforceMfaPolicy !== false && !s.user.mfa?.enabled) {
    const settings = await Setting.findById("global").lean();
    if (settings?.requireStaffMfa && !returnTo.startsWith("/admin/security")) redirect("/admin/security?required=1");
  }
  if (!hasPermission(s.actor.role, permission)) redirect("/admin?denied=1");
  return s.actor;
}

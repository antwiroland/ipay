import { Types } from "mongoose";
import { z } from "zod";
import { isStaffRole } from "@/lib/permissions";
import { loginSchema, passwordSchema, phoneSchema, registerSchema, resetPasswordSchema } from "@/lib/validation";
import { AuthToken, Session, User, type IUser } from "@/models";
import type { Actor } from "../auth/actor";
import {
  DUMMY_HASH,
  decryptField,
  encryptField,
  generateTotpSecret,
  hashPassword,
  randomToken,
  sha256,
  verifyPassword,
  verifyTotp,
} from "../auth/crypto";
import { connectDB, isDuplicateKeyError } from "../db";
import { AppError } from "../errors";
import { audit } from "./audit";
import { notify, notifyPasswordReset } from "./notifications";

export const TERMS_VERSION = "2026-10";
export const SESSION_TTL_DAYS = 14;
export const STAFF_SESSION_TTL_HOURS = 12;

function zodFieldErrors(err: z.ZodError) {
  return z.flattenError(err).fieldErrors as Record<string, string[]>;
}

export function parseOrThrow<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const r = schema.safeParse(input);
  if (!r.success) {
    throw new AppError("VALIDATION", "Please correct the highlighted fields.", { fieldErrors: zodFieldErrors(r.error) });
  }
  return r.data;
}

export function toActor(user: Pick<IUser, "_id" | "role" | "name" | "email">, mfaVerified: boolean, ip?: string | null): Actor {
  return { userId: user._id.toString(), role: user.role, name: user.name, email: user.email, mfaVerified, ip };
}

/* ---------------- Registration ---------------- */

export async function registerCustomer(input: unknown) {
  const data = parseOrThrow(registerSchema, input);
  await connectDB();
  const now = new Date();
  try {
    const user = await User.create({
      name: data.name,
      email: data.email,
      phone: data.phone,
      passwordHash: await hashPassword(data.password),
      role: "customer",
      consents: {
        termsAcceptedAt: now,
        privacyAcceptedAt: now,
        marketingConsentAt: data.marketingConsent ? now : null,
        termsVersion: TERMS_VERSION,
      },
      notificationPreferences: { email: true, sms: true, marketing: !!data.marketingConsent },
    });
    await notify(user._id, "registration", {}, { dedupeKey: `registration:${user._id}` });
    return user;
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      const field = String((err as { message?: string }).message).includes("phone") ? "phone" : "email";
      throw new AppError("CONFLICT", "An account with these details already exists.", {
        fieldErrors: { [field]: [`This ${field} is already registered. Try signing in instead.`] },
      });
    }
    throw err;
  }
}

/* ---------------- Sessions ---------------- */

export interface SessionMeta {
  userAgent?: string | null;
  ip?: string | null;
}

export async function createSession(user: Pick<IUser, "_id" | "role">, meta: SessionMeta, mfaVerified: boolean) {
  const token = randomToken(32);
  const ttl = isStaffRole(user.role) ? STAFF_SESSION_TTL_HOURS * 3600_000 : SESSION_TTL_DAYS * 86400_000;
  const expiresAt = new Date(Date.now() + ttl);
  await Session.create({
    userId: user._id,
    tokenHash: sha256(token),
    mfaVerified,
    userAgent: meta.userAgent?.slice(0, 300) ?? undefined,
    ip: meta.ip ?? undefined,
    expiresAt,
  });
  return { token, expiresAt };
}

/** Resolve a raw cookie token to an Actor. Returns null for unknown/expired/suspended. */
export async function resolveSession(token: string | undefined | null) {
  if (!token || token.length > 200) return null;
  await connectDB();
  const session = await Session.findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } }).lean();
  if (!session) return null;
  const user = await User.findById(session.userId).lean();
  if (!user || user.accountStatus !== "active") return null;
  if (user.passwordChangedAt && session.createdAt < user.passwordChangedAt) return null;
  // Touch at most every 10 minutes.
  if (Date.now() - new Date(session.lastSeenAt).getTime() > 600_000) {
    await Session.updateOne({ _id: session._id }, { $set: { lastSeenAt: new Date() } });
  }
  return { session, user, actor: toActor(user, session.mfaVerified, session.ip) };
}

export async function destroySession(token: string | undefined | null) {
  if (!token) return;
  await connectDB();
  await Session.deleteOne({ tokenHash: sha256(token) });
}

export async function revokeAllSessions(userId: string | Types.ObjectId) {
  await Session.deleteMany({ userId });
}

/* ---------------- Login ---------------- */

export async function authenticate(input: unknown) {
  const data = parseOrThrow(loginSchema, input);
  await connectDB();
  const user = await User.findOne({ email: data.email }).select("+passwordHash +mfa.secret").lean();
  const valid = await verifyPassword(data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) throw new AppError("UNAUTHENTICATED", "Incorrect email or password.");
  if (user.accountStatus !== "active") {
    throw new AppError("FORBIDDEN", "This account is suspended. Please contact iPay Ghana support.");
  }
  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
  return { user, mfaRequired: !!user.mfa?.enabled };
}

export async function verifySessionMfa(token: string, code: string) {
  await connectDB();
  const session = await Session.findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } });
  if (!session) throw new AppError("UNAUTHENTICATED", "Your session has expired. Please sign in again.");
  const user = await User.findById(session.userId).select("+mfa.secret").lean();
  if (!user?.mfa?.enabled || !user.mfa.secret) throw new AppError("INVALID_STATE", "MFA is not enabled.");
  if (!verifyTotp(decryptField(user.mfa.secret), code.trim())) {
    throw new AppError("UNAUTHENTICATED", "That code is not valid. Try the current code from your authenticator app.");
  }
  session.mfaVerified = true;
  await session.save();
  return user;
}

/* ---------------- MFA enrolment (staff) ---------------- */

export async function beginMfaEnrolment(actor: Actor) {
  await connectDB();
  const secret = generateTotpSecret();
  await User.updateOne({ _id: actor.userId }, { $set: { "mfa.pendingSecret": encryptField(secret) } });
  return secret;
}

export async function confirmMfaEnrolment(actor: Actor, code: string) {
  await connectDB();
  const user = await User.findById(actor.userId).select("+mfa.pendingSecret");
  if (!user?.mfa?.pendingSecret) throw new AppError("INVALID_STATE", "Start MFA setup first.");
  const secret = decryptField(user.mfa.pendingSecret);
  if (!verifyTotp(secret, code.trim())) throw new AppError("VALIDATION", "That code is not valid.");
  await User.updateOne(
    { _id: user._id },
    { $set: { "mfa.enabled": true, "mfa.secret": user.mfa.pendingSecret, "mfa.pendingSecret": null } },
  );
  await audit(actor, "user.mfa_enabled", "User", actor.userId);
}

export async function disableMfa(actor: Actor, password: string) {
  await connectDB();
  const user = await User.findById(actor.userId).select("+passwordHash");
  if (!user || !(await verifyPassword(password, user.passwordHash))) throw new AppError("UNAUTHENTICATED", "Incorrect password.");
  await User.updateOne({ _id: user._id }, { $set: { "mfa.enabled": false, "mfa.secret": null, "mfa.pendingSecret": null } });
  await audit(actor, "user.mfa_disabled", "User", actor.userId);
}

/* ---------------- Password reset ---------------- */

const RESET_TTL_MS = 30 * 60_000;

/** Always resolves the same way whether or not the email exists (no account enumeration). */
export async function requestPasswordReset(email: string, appUrl: string) {
  const parsed = z.email().safeParse(email.trim().toLowerCase());
  if (!parsed.success) return;
  await connectDB();
  const user = await User.findOne({ email: parsed.data }).lean();
  if (!user || user.accountStatus !== "active") return;
  await AuthToken.updateMany({ userId: user._id, type: "password_reset", usedAt: null }, { $set: { usedAt: new Date() } });
  const token = randomToken(32);
  await AuthToken.create({
    userId: user._id,
    type: "password_reset",
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
  });
  const link = `${appUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
  await notifyPasswordReset(user._id.toString(), link);
  return process.env.NODE_ENV === "test" ? token : undefined;
}

export async function resetPassword(input: unknown) {
  const data = parseOrThrow(resetPasswordSchema, input);
  await connectDB();
  const tokenDoc = await AuthToken.findOneAndUpdate(
    { tokenHash: sha256(data.token), type: "password_reset", usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
  );
  if (!tokenDoc) throw new AppError("VALIDATION", "This reset link is invalid or has expired. Request a new one.");
  await User.updateOne(
    { _id: tokenDoc.userId },
    { $set: { passwordHash: await hashPassword(data.password), passwordChangedAt: new Date() } },
  );
  await revokeAllSessions(tokenDoc.userId);
  await audit(null, "user.password_reset", "User", tokenDoc.userId.toString());
}

export async function changePassword(actor: Actor, current: string, next: string) {
  const pw = parseOrThrow(passwordSchema, next);
  await connectDB();
  const user = await User.findById(actor.userId).select("+passwordHash");
  if (!user || !(await verifyPassword(current, user.passwordHash))) {
    throw new AppError("VALIDATION", "Your current password is incorrect.", {
      fieldErrors: { currentPassword: ["Your current password is incorrect."] },
    });
  }
  user.passwordHash = await hashPassword(pw);
  user.passwordChangedAt = new Date(Date.now() - 1000); // sessions created before now are invalidated
  await user.save();
  await audit(actor, "user.password_changed", "User", actor.userId);
}

/* ---------------- Profile ---------------- */

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  emailNotifications: z.boolean(),
  smsNotifications: z.boolean(),
  marketing: z.boolean(),
});

export async function updateProfile(actor: Actor, input: unknown, currentPassword?: string) {
  const data = parseOrThrow(profileSchema, input);
  await connectDB();
  const user = await User.findById(actor.userId).select("+passwordHash");
  if (!user) throw new AppError("NOT_FOUND", "Account not found.");
  if (data.phone !== user.phone) {
    // Sensitive change: re-authenticate.
    if (!currentPassword || !(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new AppError("VALIDATION", "Confirm your password to change your phone number.", {
        fieldErrors: { currentPassword: ["Enter your current password to change your phone number."] },
      });
    }
  }
  const marketingChanged = data.marketing !== user.notificationPreferences.marketing;
  user.name = data.name;
  user.phone = data.phone;
  user.notificationPreferences = { email: data.emailNotifications, sms: data.smsNotifications, marketing: data.marketing };
  if (marketingChanged) user.consents.marketingConsentAt = data.marketing ? new Date() : null;
  try {
    await user.save();
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError("CONFLICT", "That phone number is already in use.", { fieldErrors: { phone: ["Already in use"] } });
    }
    throw err;
  }
  return user;
}

import { beforeAll, describe, expect, it } from "vitest";
import { AuditLog, Session, User } from "@/models";
import { totpCode } from "@/server/auth/crypto";
import {
  authenticate,
  beginMfaEnrolment,
  confirmMfaEnrolment,
  createSession,
  registerCustomer,
  requestPasswordReset,
  resetPassword,
  resolveSession,
  toActor,
  verifySessionMfa,
} from "@/server/services/auth";
import { changeRole, setAccountStatus } from "@/server/services/customers";
import { dashboardOverview } from "@/server/services/reports";
import { makeUser, setupDb } from "../helpers";

beforeAll(setupDb);

const reg = (email: string, phone: string) => ({
  name: "Ama Mensah",
  email,
  phone,
  password: "SecurePass123",
  confirmPassword: "SecurePass123",
  acceptTerms: true,
});

describe("registration and login", () => {
  it("registers, normalises identifiers and never stores the plain password", async () => {
    const u = await registerCustomer(reg("Ama@Example.com", "024 555 0101"));
    const stored = await User.findById(u._id).select("+passwordHash").lean();
    expect(stored!.email).toBe("ama@example.com");
    expect(stored!.phone).toBe("+233245550101");
    expect(stored!.passwordHash).not.toContain("SecurePass123");
    expect(stored!.role).toBe("customer");
  });

  it("rejects duplicate email/phone and weak input", async () => {
    await expect(registerCustomer(reg("ama@example.com", "024 555 0199"))).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(registerCustomer({ ...reg("x@example.com", "024 555 0102"), password: "short", confirmPassword: "short" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(registerCustomer({ ...reg("y@example.com", "024 555 0103"), acceptTerms: false })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("logs in with correct credentials only, with a uniform error", async () => {
    await expect(authenticate({ email: "ama@example.com", password: "SecurePass123" })).resolves.toMatchObject({ mfaRequired: false });
    const a = await authenticate({ email: "ama@example.com", password: "wrong" }).catch((e) => e);
    const b = await authenticate({ email: "nobody@example.com", password: "wrong" }).catch((e) => e);
    expect(a.message).toBe(b.message);
  });

  it("rejects NoSQL operator injection in credentials", async () => {
    await expect(authenticate({ email: { $ne: null }, password: { $ne: null } })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("sessions resolve, and are revoked on suspension", async () => {
    const actor = await makeUser();
    const user = await User.findById(actor.userId).lean();
    const { token } = await createSession(user!, {}, true);
    expect((await resolveSession(token))!.actor.userId).toBe(actor.userId);
    expect(await Session.countDocuments({ tokenHash: token })).toBe(0); // only the hash is stored
    const admin = await makeUser("admin");
    await setAccountStatus(admin, actor.userId, "suspended", "Fraud investigation");
    expect(await resolveSession(token)).toBeNull();
    await expect(authenticate({ email: user!.email, password: "Password123" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("password reset", () => {
  it("issues single-use tokens and revokes sessions", async () => {
    const u = await registerCustomer(reg("kofi@example.com", "024 555 0202"));
    const { token: sessionToken } = await createSession(u, {}, true);
    const token = await requestPasswordReset("kofi@example.com", "http://localhost:3000");
    expect(token).toBeTruthy();
    await resetPassword({ token, password: "BrandNewPass1", confirmPassword: "BrandNewPass1" });
    await expect(resetPassword({ token, password: "AnotherPass12", confirmPassword: "AnotherPass12" })).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await resolveSession(sessionToken)).toBeNull();
    await expect(authenticate({ email: "kofi@example.com", password: "BrandNewPass1" })).resolves.toBeTruthy();
  });

  it("does not reveal whether an email exists", async () => {
    await expect(requestPasswordReset("ghost@example.com", "http://x")).resolves.toBeUndefined();
  });
});

describe("staff MFA and role boundaries", () => {
  it("enrols TOTP and requires it for the session", async () => {
    const admin = await makeUser("admin");
    const secret = await beginMfaEnrolment(admin);
    await confirmMfaEnrolment(admin, totpCode(secret));
    const user = await User.findById(admin.userId).select("+mfa.secret").lean();
    expect(user!.mfa.enabled).toBe(true);
    expect(user!.mfa.secret).not.toBe(secret); // encrypted at rest
    const { token } = await createSession(user!, {}, false);
    expect((await resolveSession(token))!.session.mfaVerified).toBe(false);
    await expect(verifySessionMfa(token, "000000")).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await verifySessionMfa(token, totpCode(secret));
    expect((await resolveSession(token))!.session.mfaVerified).toBe(true);
  });

  it("customers cannot reach admin services; only super admins manage roles", async () => {
    const customer = await makeUser();
    await expect(dashboardOverview(customer)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const admin = await makeUser("admin");
    const target = await makeUser("support");
    await expect(changeRole(admin, target.userId, "finance_officer", "Promotion to finance")).rejects.toMatchObject({ code: "FORBIDDEN" });
    const sup = await makeUser("super_admin");
    await changeRole(sup, target.userId, "finance_officer", "Promotion to finance");
    expect((await User.findById(target.userId).lean())!.role).toBe("finance_officer");
    expect(await AuditLog.countDocuments({ action: "staff.role_change", resourceId: target.userId })).toBe(1);
    expect(toActor((await User.findById(target.userId).lean())!, true).role).toBe("finance_officer");
  });
});

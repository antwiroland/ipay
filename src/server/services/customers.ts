import { Types } from "mongoose";
import { z } from "zod";
import { hasPermission, maskEmail, maskPhone, ROLES, STAFF_ROLES, type Role } from "@/lib/permissions";
import { emailSchema, escapeRegex, phoneSchema } from "@/lib/validation";
import { CustomerNote, IdentityVerification, Order, Payment, User } from "@/models";
import { type Actor, requireCustomer, requirePermission } from "../auth/actor";
import { hashPassword, hmacSha256, randomToken } from "../auth/crypto";
import { connectDB, isDuplicateKeyError, withTransaction } from "../db";
import { AppError } from "../errors";
import { audit } from "./audit";
import { parseOrThrow, revokeAllSessions, TERMS_VERSION } from "./auth";
import { notify } from "./notifications";

export function presentContact(actor: Actor, u: { email: string; phone: string }) {
  const pii = hasPermission(actor.role, "customers.pii");
  return { email: pii ? u.email : maskEmail(u.email), phone: pii ? u.phone : maskPhone(u.phone), masked: !pii };
}

export async function listCustomers(
  actor: Actor,
  opts: { q?: string; verification?: string; status?: string; hasActive?: string; page?: number; pageSize?: number },
) {
  requirePermission(actor, "customers.view");
  await connectDB();
  const filter: Record<string, unknown> = { role: "customer" };
  if (opts.q) {
    const rx = new RegExp(escapeRegex(opts.q.slice(0, 60)), "i");
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  if (opts.verification && ["unverified", "pending", "verified", "rejected"].includes(opts.verification)) filter.verificationStatus = opts.verification;
  if (opts.status && ["active", "suspended"].includes(opts.status)) filter.accountStatus = opts.status;
  if (opts.hasActive === "yes" || opts.hasActive === "no") {
    const ids = await Order.distinct("customerId", { isActive: true });
    filter._id = opts.hasActive === "yes" ? { $in: ids } : { $nin: ids };
  }
  const pageSize = Math.min(100, opts.pageSize ?? 20);
  const page = Math.max(1, opts.page ?? 1);
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    User.countDocuments(filter),
  ]);
  const ids = users.map((u) => u._id);
  const [orders, paid] = await Promise.all([
    Order.find({ customerId: { $in: ids }, isActive: true }).select("customerId orderNumber outstandingBalance").lean(),
    Order.aggregate([{ $match: { customerId: { $in: ids } } }, { $group: { _id: "$customerId", paid: { $sum: "$amountPaid" }, outstanding: { $sum: { $cond: ["$isActive", "$outstandingBalance", 0] } } } }]),
  ]);
  const items = users.map((u) => {
    const active = orders.find((o) => o.customerId.equals(u._id));
    const agg = paid.find((p) => p._id.equals(u._id));
    return {
      id: u._id.toString(),
      name: u.name,
      ...presentContact(actor, u),
      createdAt: u.createdAt,
      verificationStatus: u.verificationStatus,
      accountStatus: u.accountStatus,
      activeOrder: active ? { id: active._id.toString(), orderNumber: active.orderNumber } : null,
      totalPaid: agg?.paid ?? 0,
      outstanding: agg?.outstanding ?? 0,
    };
  });
  return { items, total, page, pageSize };
}

export async function getCustomerDetail(actor: Actor, customerId: string) {
  requirePermission(actor, "customers.view");
  if (!Types.ObjectId.isValid(customerId)) throw new AppError("NOT_FOUND", "Customer not found.");
  await connectDB();
  const user = await User.findOne({ _id: customerId, role: "customer" }).lean();
  if (!user) throw new AppError("NOT_FOUND", "Customer not found.");
  const [orders, payments, verifications, notes] = await Promise.all([
    Order.find({ customerId }).sort({ createdAt: -1 }).lean(),
    hasPermission(actor.role, "payments.view") ? Payment.find({ customerId }).sort({ createdAt: -1 }).limit(200).lean() : Promise.resolve([]),
    IdentityVerification.find({ userId: customerId }).sort({ createdAt: -1 }).lean(),
    CustomerNote.find({ customerId }).sort({ createdAt: -1 }).populate("authorId", "name").lean(),
  ]);
  return { user: { ...user, ...presentContact(actor, user) }, orders, payments, verifications, notes };
}

export async function addCustomerNote(actor: Actor, customerId: string, body: string) {
  requirePermission(actor, "customers.notes");
  const text = z.string().trim().min(2).max(2000).parse(body);
  await connectDB();
  await CustomerNote.create({ customerId, authorId: actor.userId, body: text });
  await audit(actor, "customer.note", "User", customerId);
}

export async function setAccountStatus(actor: Actor, customerId: string, status: "active" | "suspended", reason: string) {
  requirePermission(actor, "customers.suspend");
  if (!reason || reason.trim().length < 5) throw new AppError("VALIDATION", "A reason is required.");
  await connectDB();
  const user = await User.findOneAndUpdate({ _id: customerId, role: "customer" }, { $set: { accountStatus: status } }, { returnDocument: "after" });
  if (!user) throw new AppError("NOT_FOUND", "Customer not found.");
  if (status === "suspended") await revokeAllSessions(user._id);
  await audit(actor, status === "suspended" ? "customer.suspend" : "customer.reactivate", "User", customerId, { reason });
}

/* ---------------- Identity verification ---------------- */

const verificationSchema = z.object({
  documentType: z.enum(["ghana_card", "passport", "drivers_licence", "voter_id"]),
  idNumber: z.string().trim().toUpperCase().min(6).max(30),
  dateOfBirth: z.coerce.date().refine((d) => d < new Date(Date.now() - 18 * 365.25 * 86400000), "You must be 18 or older"),
  consent: z.literal(true, { error: "Consent is required" }),
});

export function normalizeIdNumber(type: string, raw: string) {
  const s = raw.replace(/[\s-]/g, "").toUpperCase();
  if (type === "ghana_card" && !/^GHA\d{9}\d$/.test(s)) {
    throw new AppError("VALIDATION", "Enter a Ghana Card number like GHA-123456789-0.", { fieldErrors: { idNumber: ["Invalid Ghana Card number"] } });
  }
  return s;
}

/** Customer submits ID details. Only the type, last 4 characters and a keyed hash are stored. */
export async function submitVerification(actor: Actor, input: unknown) {
  requireCustomer(actor);
  const data = parseOrThrow(verificationSchema, input);
  const normalized = normalizeIdNumber(data.documentType, data.idNumber);
  const secret = process.env.ID_HASH_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error("ID_HASH_SECRET is not configured");
  const idHash = hmacSha256(secret, `${data.documentType}:${normalized}`);
  await connectDB();
  const duplicate = await IdentityVerification.findOne({ idHash, status: { $in: ["pending", "verified"] }, userId: { $ne: actor.userId } }).lean();
  if (duplicate) throw new AppError("CONFLICT", "This ID is already linked to another account. Please contact support.");
  await withTransaction(async (session) => {
    await IdentityVerification.updateMany({ userId: actor.userId, status: "pending" }, { $set: { status: "rejected", reviewNote: "Superseded" } }, { session });
    await IdentityVerification.create(
      [{ userId: actor.userId, documentType: data.documentType, idLast4: normalized.slice(-4), idHash, dateOfBirth: data.dateOfBirth, method: "in_person", status: "pending" }],
      { session },
    );
    await User.updateOne({ _id: actor.userId, verificationStatus: { $ne: "verified" } }, { $set: { verificationStatus: "pending" } }, { session });
  });
}

export async function reviewVerification(actor: Actor, verificationId: string, decision: "verified" | "rejected", note: string) {
  requirePermission(actor, "customers.verify");
  if (decision === "rejected" && (!note || note.trim().length < 5)) throw new AppError("VALIDATION", "Give a reason for rejecting.");
  const v = await withTransaction(async (session) => {
    const v = await IdentityVerification.findOneAndUpdate(
      { _id: verificationId, status: "pending" },
      { $set: { status: decision, reviewedBy: actor.userId, reviewedAt: new Date(), reviewNote: note || null } },
      { session, returnDocument: "after" },
    );
    if (!v) throw new AppError("INVALID_STATE", "This verification has already been reviewed.");
    await User.updateOne({ _id: v.userId }, { $set: { verificationStatus: decision } }, { session });
    await audit(actor, `verification.${decision}`, "User", v.userId.toString(), { session, reason: note || null });
    return v;
  });
  await notify(v.userId, "verification_result", { status: decision, note: decision === "rejected" ? note : "" }, { dedupeKey: `verification:${v._id}` });
}

/* ---------------- Staff ---------------- */

const staffSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  phone: phoneSchema,
  role: z.enum(STAFF_ROLES as [Role, ...Role[]]),
});

export async function listStaff(actor: Actor) {
  requirePermission(actor, "staff.manage");
  await connectDB();
  return User.find({ role: { $in: STAFF_ROLES } }).sort({ role: 1, name: 1 }).lean();
}

/** Creates a staff account with a one-time temporary password (shown once to the Super Admin). */
export async function createStaff(actor: Actor, input: unknown) {
  requirePermission(actor, "staff.manage");
  const data = parseOrThrow(staffSchema, input);
  await connectDB();
  const tempPassword = `${randomToken(9)}9a`;
  try {
    const now = new Date();
    const u = await User.create({
      ...data,
      passwordHash: await hashPassword(tempPassword),
      consents: { termsAcceptedAt: now, privacyAcceptedAt: now, termsVersion: TERMS_VERSION },
      notificationPreferences: { email: true, sms: false, marketing: false },
    });
    await audit(actor, "staff.create", "User", u._id.toString(), { metadata: { role: data.role } });
    return { user: u, tempPassword };
  } catch (err) {
    if (isDuplicateKeyError(err)) throw new AppError("CONFLICT", "A user with this email or phone already exists.");
    throw err;
  }
}

export async function changeRole(actor: Actor, userId: string, role: Role, reason: string) {
  requirePermission(actor, "staff.manage");
  if (!ROLES.includes(role)) throw new AppError("VALIDATION", "Unknown role.");
  if (userId === actor.userId) throw new AppError("FORBIDDEN", "You cannot change your own role.");
  if (!reason || reason.trim().length < 5) throw new AppError("VALIDATION", "A reason is required.");
  await connectDB();
  const target = await User.findById(userId);
  if (!target) throw new AppError("NOT_FOUND", "User not found.");
  if (target.role === "customer" || role === "customer") throw new AppError("FORBIDDEN", "Customer accounts cannot be converted to staff here.");
  const from = target.role;
  if (from === "super_admin") {
    const supers = await User.countDocuments({ role: "super_admin", accountStatus: "active" });
    if (supers <= 1) throw new AppError("FORBIDDEN", "At least one active Super Admin is required.");
  }
  target.role = role;
  await target.save();
  await revokeAllSessions(target._id);
  await audit(actor, "staff.role_change", "User", userId, { reason, metadata: { from, to: role } });
}

export async function setStaffStatus(actor: Actor, userId: string, status: "active" | "suspended", reason: string) {
  requirePermission(actor, "staff.manage");
  if (userId === actor.userId) throw new AppError("FORBIDDEN", "You cannot suspend yourself.");
  await connectDB();
  const u = await User.findOneAndUpdate({ _id: userId, role: { $in: STAFF_ROLES } }, { $set: { accountStatus: status } }, { returnDocument: "after" });
  if (!u) throw new AppError("NOT_FOUND", "Staff member not found.");
  if (status === "suspended") await revokeAllSessions(u._id);
  await audit(actor, `staff.${status}`, "User", userId, { reason });
}

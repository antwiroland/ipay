import { hasPermission, isStaffRole, type Permission, type Role } from "@/lib/permissions";
import { AppError } from "../errors";

/** The authenticated principal passed explicitly into every service call. */
export interface Actor {
  userId: string;
  role: Role;
  name: string;
  email: string;
  mfaVerified: boolean;
  ip?: string | null;
}

export const SYSTEM_ACTOR: Actor = {
  userId: "000000000000000000000000",
  role: "super_admin",
  name: "System",
  email: "system@ipayghana.local",
  mfaVerified: true,
};

export function isSystem(actor: Actor) {
  return actor.userId === SYSTEM_ACTOR.userId;
}

export function requirePermission(actor: Actor | null | undefined, permission: Permission): asserts actor is Actor {
  if (!actor) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.");
  if (!hasPermission(actor.role, permission)) {
    throw new AppError("FORBIDDEN", "You do not have permission to perform this action.");
  }
}

export function requireCustomer(actor: Actor | null | undefined): asserts actor is Actor {
  if (!actor) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.");
  if (actor.role !== "customer") throw new AppError("FORBIDDEN", "Only customer accounts can place installment orders.");
}

export function isStaff(actor: Actor | null | undefined): boolean {
  return !!actor && isStaffRole(actor.role);
}

/** Customers can only touch their own records; staff need the given permission. */
export function assertOwnerOrPermission(actor: Actor | null | undefined, ownerId: string, permission: Permission) {
  if (!actor) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.");
  if (actor.userId === ownerId) return;
  if (hasPermission(actor.role, permission)) return;
  // Respond as not found so record existence is not disclosed to other customers.
  throw new AppError("NOT_FOUND", "Record not found.");
}

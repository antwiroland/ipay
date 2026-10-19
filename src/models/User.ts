import { Schema, type Types } from "mongoose";
import { ROLES, type Role } from "@/lib/permissions";
import { getModel } from "./_helpers";

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string; // normalized lower-case
  phone: string; // normalized +233XXXXXXXXX
  passwordHash: string;
  role: Role;
  verificationStatus: "unverified" | "pending" | "verified" | "rejected";
  accountStatus: "active" | "suspended";
  notificationPreferences: { email: boolean; sms: boolean; marketing: boolean };
  consents: { termsAcceptedAt: Date; privacyAcceptedAt: Date; marketingConsentAt?: Date | null; termsVersion: string };
  mfa: { enabled: boolean; secret?: string | null; pendingSecret?: string | null };
  passwordChangedAt?: Date | null;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: "customer", index: true },
    verificationStatus: { type: String, enum: ["unverified", "pending", "verified", "rejected"], default: "unverified" },
    accountStatus: { type: String, enum: ["active", "suspended"], default: "active" },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      marketing: { type: Boolean, default: false },
    },
    consents: {
      termsAcceptedAt: { type: Date, required: true },
      privacyAcceptedAt: { type: Date, required: true },
      marketingConsentAt: { type: Date, default: null },
      termsVersion: { type: String, required: true },
    },
    mfa: {
      enabled: { type: Boolean, default: false },
      secret: { type: String, default: null, select: false },
      pendingSecret: { type: String, default: null, select: false },
    },
    passwordChangedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ phone: 1 }, { unique: true });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ name: "text", email: "text", phone: "text" });

export const User = getModel<IUser>("User", UserSchema);

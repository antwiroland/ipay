import { Schema, type Types } from "mongoose";
import { getModel } from "./_helpers";

export interface ISession {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  mfaVerified: boolean;
  userAgent?: string;
  ip?: string;
  expiresAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    mfaVerified: { type: Boolean, default: false },
    userAgent: String,
    ip: String,
    expiresAt: { type: Date, required: true },
    lastSeenAt: { type: Date, default: () => new Date() },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = getModel<ISession>("Session", SessionSchema);

export interface IAuthToken {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: "password_reset";
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date | null;
  createdAt: Date;
}

const AuthTokenSchema = new Schema<IAuthToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["password_reset"], required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
AuthTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

export const AuthToken = getModel<IAuthToken>("AuthToken", AuthTokenSchema);

/** Fixed-window rate-limit counters (shared across serverless instances). */
export interface IRateLimit {
  _id: string; // `${bucket}:${key}:${window}`
  count: number;
  expiresAt: Date;
}
const RateLimitSchema = new Schema<IRateLimit>({
  _id: { type: String },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});
RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const RateLimit = getModel<IRateLimit>("RateLimit", RateLimitSchema);

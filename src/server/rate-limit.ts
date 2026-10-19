import { RateLimit } from "@/models";
import { connectDB } from "./db";
import { AppError } from "./errors";

/**
 * Fixed-window rate limiter stored in MongoDB so it holds across serverless instances.
 * Throws RATE_LIMITED when `limit` is exceeded within `windowSeconds`.
 */
export async function rateLimit(bucket: string, key: string, limit: number, windowSeconds: number): Promise<void> {
  if (process.env.DISABLE_RATE_LIMIT === "true" && process.env.NODE_ENV !== "production") return;
  await connectDB();
  const window = Math.floor(Date.now() / (windowSeconds * 1000));
  const id = `${bucket}:${key}:${window}`;
  const doc = await RateLimit.findOneAndUpdate(
    { _id: id },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((window + 1) * windowSeconds * 1000) } },
    { upsert: true, returnDocument: "after" },
  ).lean();
  if (doc && doc.count > limit) {
    throw new AppError("RATE_LIMITED", "Too many attempts. Please wait a moment and try again.");
  }
}

import mongoose, { type ClientSession } from "mongoose";

mongoose.set("strictQuery", true);

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const g = globalThis as unknown as { __mongoose?: Cache };
const cache: Cache = g.__mongoose ?? (g.__mongoose = { conn: null, promise: null });

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not configured. Copy .env.example to .env.local.");
  if (!cache.promise) {
    // Optional: some local networks (notably on Windows) refuse Node's SRV lookups for mongodb+srv:// URIs.
    // DNS_SERVERS=8.8.8.8,1.1.1.1 makes Node use explicit resolvers. Leave unset in production.
    if (process.env.DNS_SERVERS) {
      const dns = await import("node:dns");
      dns.setServers(process.env.DNS_SERVERS.split(",").map((s) => s.trim()).filter(Boolean));
    }
    cache.promise = mongoose
      .connect(uri, {
        dbName: process.env.MONGODB_DB || undefined,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10_000,
        autoIndex: process.env.NODE_ENV !== "production" || process.env.MONGODB_AUTO_INDEX === "true",
      })
      .catch((err) => {
        cache.promise = null;
        throw err;
      });
  }
  cache.conn = await cache.promise;
  return cache.conn;
}

/**
 * Run `fn` inside a MongoDB transaction (requires a replica set — MongoDB Atlas, or a local `--replSet`).
 * Transient transaction errors are retried by the driver's withTransaction().
 */
export async function withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  await connectDB();
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(
      async () => {
        result = await fn(session);
      },
      { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, readPreference: "primary" },
    );
    return result as T;
  } finally {
    await session.endSession();
  }
}

export function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: number }).code === 11000;
}

export function isTransientTxnError(err: unknown): boolean {
  const labels = (err as { errorLabels?: string[]; errorLabelSet?: Set<string> }) ?? {};
  const set = labels.errorLabelSet ?? new Set(labels.errorLabels ?? []);
  return set.has("TransientTransactionError") || (err as { code?: number })?.code === 112; // WriteConflict
}

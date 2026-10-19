/**
 * End-to-end test server: in-memory MongoDB replica set → seed → `next dev` on the given port.
 * Used by playwright.config.ts. Never touches a real database.
 */
import { spawn, spawnSync } from "node:child_process";
import { MongoMemoryReplSet } from "mongodb-memory-server";

async function main() {
  const port = process.argv[2] || "3100";
  const rs = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  const env = {
    ...process.env,
    MONGODB_URI: rs.getUri(),
    MONGODB_DB: "ipay_e2e",
    APP_URL: `http://localhost:${port}`,
    AUTH_SECRET: "e2e-auth-secret-that-is-definitely-long-enough",
    APP_ENCRYPTION_KEY: "e2e-encryption-key-that-is-definitely-long-enough",
    ID_HASH_SECRET: "e2e-id-hash",
    PAYMENT_PROVIDER: "mock",
    DISABLE_RATE_LIMIT: "true",
    MONGODB_AUTO_INDEX: "true",
  };
  const seed = spawnSync("npx", ["tsx", "scripts/seed.ts"], { env, stdio: "inherit", shell: true });
  if (seed.status !== 0) throw new Error("Seed failed");
  const app = spawn("npx", ["next", "dev", "--port", port], { env, stdio: "inherit", shell: true });
  const stop = async () => {
    app.kill();
    await rs.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  app.on("exit", async (code) => {
    await rs.stop();
    process.exit(code ?? 0);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Local development database: a persistent single-node MongoDB replica set (transactions need a replica set).
 * Usage: npm run db:dev   → then set MONGODB_URI=mongodb://127.0.0.1:27027/?replicaSet=ipay-dev
 * Data is stored in ./.data/mongo. Not for production — use MongoDB Atlas.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { MongoMemoryReplSet } from "mongodb-memory-server";

async function main() {
  const dbPath = path.join(process.cwd(), ".data", "mongo");
  mkdirSync(dbPath, { recursive: true });
  const rs = await MongoMemoryReplSet.create({
    replSet: { name: "ipay-dev", count: 1, storageEngine: "wiredTiger" },
    instanceOpts: [{ port: 27027, dbPath }],
  });
  console.log(`MongoDB dev replica set running.\nMONGODB_URI=${rs.getUri()}\nPress Ctrl+C to stop.`);
  const stop = async () => {
    await rs.stop({ doCleanup: false });
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

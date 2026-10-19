import { MongoMemoryReplSet } from "mongodb-memory-server";
import type { TestProject } from "vitest/node";

let replSet: MongoMemoryReplSet | undefined;

/** One single-node replica set for the whole run (transactions require a replica set). */
export default async function setup(project: TestProject) {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  const uri = replSet.getUri();
  process.env.MONGODB_URI = uri;
  project.provide("mongoUri", uri);
  return async () => {
    await replSet?.stop();
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

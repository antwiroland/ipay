import mongoose from "mongoose";
import { afterAll, beforeAll, inject } from "vitest";

beforeAll(async () => {
  process.env.MONGODB_URI = inject("mongoUri");
  // Isolate each test file in its own database.
  process.env.MONGODB_DB = `ipay_test_${Math.random().toString(36).slice(2, 10)}`;
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  (globalThis as { __mongoose?: unknown }).__mongoose = undefined;
});

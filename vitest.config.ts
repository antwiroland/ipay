import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    globalSetup: ["tests/setup/global-setup.ts"],
    setupFiles: ["tests/setup/per-file.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      AUTH_SECRET: "test-auth-secret-that-is-long-enough-1234567890",
      APP_ENCRYPTION_KEY: "test-encryption-key-that-is-long-enough-123456",
      ID_HASH_SECRET: "test-id-hash-secret",
      PAYMENT_PROVIDER: "mock",
      APP_URL: "http://localhost:3000",
      DISABLE_RATE_LIMIT: "true",
    },
  },
});

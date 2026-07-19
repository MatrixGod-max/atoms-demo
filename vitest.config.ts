import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    // One fork for everything: parallel collector forks re-import db/jobs and
    // race the shared .test-data SQLite (startup cleanup + WAL contention).
    // (vitest 4 removed poolOptions.forks.singleFork; sequential files + no
    // isolation reuses the same fork end to end.)
    isolate: false,
    env: {
      DATA_DIR: path.resolve(__dirname, ".test-data"),
      AGENT_MOCK: "1",
      NATIVE_BUILD_MOCK: "1",
      SPEECH_MOCK: "1",
      CONNECTOR_MOCK: "1",
    },
    testTimeout: 60_000,
  },
});

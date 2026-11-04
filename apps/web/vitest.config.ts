import { defineConfig } from "vitest/config";

// Unit tests for pure logic/helpers only (no component or browser tests).
// TZ is pinned so local-date helpers behave the same on every machine and in CI.
process.env.TZ = "UTC";

export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts"],
    globals: false,
    environment: "node",
    env: { TZ: "UTC" },
  },
});

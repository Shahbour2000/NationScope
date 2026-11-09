import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // The build-optimizer suites are exhaustive CPU-bound searches that sit near the 5s default on slower machines/CI runners.
  test: { include: ["tests/**/*.test.ts"], environment: "node", testTimeout: 30_000 },
});

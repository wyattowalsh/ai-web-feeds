import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const rootDir = fileURLToPath(new URL("./", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": rootDir,
      "server-only": fileURLToPath(new URL("./vitest.server-only.ts", import.meta.url)),
    },
  },
  test: {
    testTimeout: 15_000,
    maxWorkers: 4,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**", ".next/**", "node_modules/**", "playwright-report/**"],
    restoreMocks: true,
  },
});

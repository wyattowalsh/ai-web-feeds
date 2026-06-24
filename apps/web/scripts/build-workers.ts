/**
 * Bundle Web Workers for production / static hosting.
 *
 * Usage:
 *   pnpm exec tsx scripts/build-workers.ts
 *   pnpm exec tsx scripts/build-workers.ts --watch
 */

import { mkdirSync, watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "workers");

async function bundleWorkers(): Promise<void> {
  const { build } = await import("esbuild");

  mkdirSync(outDir, { recursive: true });

  await build({
    entryPoints: [path.join(root, "workers", "search.worker.ts")],
    outfile: path.join(outDir, "search.worker.js"),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    sourcemap: true,
    logLevel: "info",
  });

  console.log(`Built workers → ${path.relative(root, outDir)}`);
}

const watchMode = process.argv.includes("--watch");

if (watchMode) {
  const workerSource = path.join(root, "workers", "search.worker.ts");
  void bundleWorkers();
  watch(workerSource, () => {
    void bundleWorkers();
  });
  console.log("Watching worker sources…");
} else {
  void bundleWorkers();
}

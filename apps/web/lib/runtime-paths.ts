import "server-only";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

if (typeof window !== "undefined" && process.env.NODE_ENV !== "test") {
  throw new Error("lib/runtime-paths.ts is server-only");
}

const DATA_DIR_CANDIDATES = [
  resolve(process.cwd(), "data"),
  resolve(process.cwd(), "..", "..", "data"),
];

export function resolveDataDir(): string {
  return DATA_DIR_CANDIDATES.find((candidate) => existsSync(candidate)) ?? DATA_DIR_CANDIDATES[0];
}

export function resolveDataPath(...segments: string[]): string {
  return resolve(resolveDataDir(), ...segments);
}

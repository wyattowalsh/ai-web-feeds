import "server-only";
import { isAbsolute, resolve } from "node:path";

import { resolveDataPath } from "@/lib/runtime-paths";

const DEV_TELEMETRY_SALT = "aiwf-dev-salt";

if (typeof window !== "undefined" && process.env.NODE_ENV !== "test") {
  throw new Error("lib/server-env.ts is server-only");
}

function resolveServerPath(
  name: string,
  configuredValue: string | undefined,
  fallback: string,
): string {
  const candidate = configuredValue?.trim() || fallback;
  if (!candidate.trim()) {
    throw new Error(`${name} cannot be empty`);
  }

  return isAbsolute(candidate) ? candidate : resolve(process.cwd(), candidate);
}

export function getTelemetryDirectory(): string {
  const configured = process.env.AIWF_TELEMETRY_DIR?.trim();
  if (!configured) {
    return resolveDataPath("telemetry");
  }

  return resolveServerPath("AIWF_TELEMETRY_DIR", configured, resolveDataPath("telemetry"));
}

export function getTelemetrySalt(): string {
  return (
    process.env.AIWF_TELEMETRY_SALT?.trim() ||
    process.env.AIWF_ADMIN_SESSION_SECRET?.trim() ||
    DEV_TELEMETRY_SALT
  );
}

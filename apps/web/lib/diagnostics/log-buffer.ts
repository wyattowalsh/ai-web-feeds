/**
 * Ring buffer for client-side diagnostic logs (max 500 entries).
 */

import { makeClientId } from "@/lib/random-id";

export type DiagnosticLevel = "debug" | "info" | "warn" | "error";

export interface DiagnosticEntry {
  id: string;
  level: DiagnosticLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: number;
}

const MAX_ENTRIES = 500;
const buffer: DiagnosticEntry[] = [];

function nextId(): string {
  return makeClientId("log_");
}

export function appendDiagnostic(
  level: DiagnosticLevel,
  message: string,
  context?: Record<string, unknown>,
): DiagnosticEntry {
  const entry: DiagnosticEntry = {
    id: nextId(),
    level,
    message,
    context,
    timestamp: Date.now(),
  };
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) {
    buffer.splice(0, buffer.length - MAX_ENTRIES);
  }
  return entry;
}

export function getDiagnostics(): DiagnosticEntry[] {
  return [...buffer];
}

export function clearDiagnostics(): void {
  buffer.length = 0;
}

export function exportDiagnosticsJson(): string {
  return JSON.stringify(getDiagnostics(), null, 2);
}

export const diagnosticLog = {
  debug: (message: string, context?: Record<string, unknown>) =>
    appendDiagnostic("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) =>
    appendDiagnostic("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) =>
    appendDiagnostic("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) =>
    appendDiagnostic("error", message, context),
  getAll: getDiagnostics,
  clear: clearDiagnostics,
  exportJson: exportDiagnosticsJson,
};

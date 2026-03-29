/**
 * Backend integration helpers
 *
 * Shared utilities for calling the Python backend, handling URLs, and standardizing error responses.
 */

export class BackendError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "BackendError";
  }
}

export function getBackendUrl(): string {
  const url = process.env.BACKEND_URL?.trim();
  if (!url) {
    throw new Error("BACKEND_URL environment variable not configured");
  }
  return url;
}

export function buildBackendUrl(path: string, params?: Record<string, string | number | boolean>): string {
  const url = new URL(path, getBackendUrl());
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    }
  }
  return url.toString();
}

export async function fetchBackend(
  path: string,
  options: {
    method?: string;
    params?: Record<string, string | number | boolean>;
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {},
): Promise<unknown> {
  const { method = "GET", params, body, headers = {} } = options;
  const url = buildBackendUrl(path, params);

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new BackendError(
      response.status,
      errorBody.code || `HTTP_${response.status}`,
      errorBody.message || `Backend returned ${response.status}`,
      errorBody.context,
    );
  }

  return response.json();
}

export function formatBackendErrorResponse(
  error: unknown,
): { error: string; request_id?: string; code?: string } {
  if (error instanceof BackendError) {
    return {
      error: error.message,
      code: error.code,
    };
  }

  if (error instanceof Error) {
    return {
      error: error.message,
    };
  }

  return {
    error: "Internal server error",
  };
}

export function encodeQueryParam(value: string): string {
  return encodeURIComponent(value);
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function validateUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

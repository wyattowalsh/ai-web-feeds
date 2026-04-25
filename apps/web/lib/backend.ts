/**
 * Backend integration helpers
 *
 * Shared utilities for calling the Python backend, handling URLs, and standardizing error responses.
 */

import { getRequiredBackendUrl } from "@/lib/env";

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

export class BackendConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackendConfigurationError";
  }
}

export const FEATURE_UNAVAILABLE_CODE = "FEATURE_UNAVAILABLE";

export function getBackendUrl(): string {
  const url = process.env.BACKEND_URL?.trim();
  if (!url) {
    throw new BackendConfigurationError("BACKEND_URL environment variable not configured");
  }
}

export function buildBackendUrl(
  path: string,
  params?: Record<string, string | number | boolean>,
): string {
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

export async function fetchBackendResponse(
  path: string,
  options: {
    method?: string;
    params?: Record<string, string | number | boolean>;
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {},
): Promise<Response> {
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

  return response;
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
  const response = await fetchBackendResponse(path, options);

  return response.json();
}

export function formatBackendErrorResponse(error: unknown): {
  error: string;
  request_id?: string;
  code?: string;
} {
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

export function getBackendErrorStatus(error: unknown): number {
  if (error instanceof BackendError) {
    return error.status;
  }

  if (error instanceof BackendConfigurationError) {
    return 503;
  }

  return 500;
}

export function createFeatureUnavailableResponse(
  feature: string,
  detail?: string,
): {
  error: string;
  code: string;
} {
  return {
    error:
      detail ?? `${feature} requires a configured BACKEND_URL backend service in this deployment.`,
    code: FEATURE_UNAVAILABLE_CODE,
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

import { randomUUID } from "node:crypto";
import { after, NextResponse } from "next/server";
import { DatabaseNotConfiguredError } from "@/lib/server/db";
import { recordApiRequestLog } from "@/lib/server/telemetry-store";
import { hasBetterAuthSessionCookie } from "@/lib/auth-session-cookie";
import {
  hashClientIp,
  recordApiTelemetry,
  redactErrorMessage,
  type ApiTelemetryEvent,
} from "@/lib/telemetry";

type RouteHandlerContext = { params: Promise<Record<string, string>> };

type RouteHandlerWithoutContext<TRequest extends Request = Request> = (
  request: TRequest,
) => Promise<Response>;

type RouteHandlerWithContext<TRequest extends Request = Request, TContext = RouteHandlerContext> = (
  request: TRequest,
  context: TContext,
) => Promise<Response>;

type RouteHandler<TRequest extends Request = Request, TContext = RouteHandlerContext> =
  | RouteHandlerWithoutContext<TRequest>
  | RouteHandlerWithContext<TRequest, TContext>;

type TelemetryOptions = {
  backendTarget?: string | null;
};

function resolveQueryKeys(url: URL): string[] {
  return [...new Set([...url.searchParams.keys()])].sort();
}

function queueTelemetryWrite(event: ApiTelemetryEvent): void {
  after(async () => {
    await recordApiTelemetry(event);

    try {
      await recordApiRequestLog(event);
    } catch (error) {
      if (!(error instanceof DatabaseNotConfiguredError)) {
        console.error("Failed to persist api_request_log", error);
      }
    }
  });
}

function readHeader(request: Request, name: string): string | null {
  try {
    return request.headers.get(name);
  } catch {
    return null;
  }
}

function readMethod(request: Request): string {
  try {
    return request.method || "GET";
  } catch {
    return "GET";
  }
}

function readUrl(request: Request): URL {
  try {
    const rawUrl = request.url;
    if (rawUrl) {
      return new URL(rawUrl);
    }
  } catch {
    // Ignore static export request shims that do not fully implement Request internals.
  }

  return new URL("http://localhost/");
}

function readClientIp(request: Request): string | null {
  const forwardedFor = readHeader(request, "x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return readHeader(request, "x-real-ip") ?? readHeader(request, "cf-connecting-ip");
}

export function withRouteTelemetry<TRequest extends Request = Request>(
  routeKey: string,
  handler: RouteHandlerWithoutContext<TRequest>,
  options?: TelemetryOptions,
): RouteHandlerWithoutContext<TRequest>;
export function withRouteTelemetry<
  TRequest extends Request = Request,
  TContext = RouteHandlerContext,
>(
  routeKey: string,
  handler: RouteHandlerWithContext<TRequest, TContext>,
  options?: TelemetryOptions,
): RouteHandlerWithContext<TRequest, TContext>;
export function withRouteTelemetry<
  TRequest extends Request = Request,
  TContext = RouteHandlerContext,
>(routeKey: string, handler: RouteHandler<TRequest, TContext>, options: TelemetryOptions = {}) {
  return async (request: TRequest, context?: TContext): Promise<Response> => {
    const startedAt = performance.now();
    const requestId = readHeader(request, "x-request-id") || randomUUID();
    const url = readUrl(request);
    const method = readMethod(request);
    const ipHash = hashClientIp(readClientIp(request));

    try {
      const response =
        context === undefined
          ? await (handler as RouteHandlerWithoutContext<TRequest>)(request)
          : await (handler as RouteHandlerWithContext<TRequest, TContext>)(request, context);
      const durationMs = Number((performance.now() - startedAt).toFixed(2));

      response.headers.set("x-request-id", requestId);

      queueTelemetryWrite({
        requestId,
        timestamp: new Date().toISOString(),
        routeKey,
        pathname: url.pathname,
        method,
        statusCode: response.status,
        durationMs,
        cacheControl: response.headers.get("cache-control"),
        backendTarget: options.backendTarget ?? null,
        errorCode: response.status >= 500 ? `HTTP_${response.status}` : null,
        errorMessage: null,
        userAgent: readHeader(request, "user-agent"),
        ipHash,
        sessionCookiePresent: hasBetterAuthSessionCookie(readHeader(request, "cookie")),
        queryKeys: resolveQueryKeys(url),
        source: "next-route-handler",
      });

      return response;
    } catch (error) {
      const durationMs = Number((performance.now() - startedAt).toFixed(2));

      queueTelemetryWrite({
        requestId,
        timestamp: new Date().toISOString(),
        routeKey,
        pathname: url.pathname,
        method,
        statusCode: 500,
        durationMs,
        cacheControl: null,
        backendTarget: options.backendTarget ?? null,
        errorCode: error instanceof Error ? error.name : "UnhandledError",
        errorMessage: redactErrorMessage(error),
        userAgent: readHeader(request, "user-agent"),
        ipHash,
        sessionCookiePresent: hasBetterAuthSessionCookie(readHeader(request, "cookie")),
        queryKeys: resolveQueryKeys(url),
        source: "next-route-handler",
      });

      return NextResponse.json(
        {
          error: "Internal server error",
          request_id: requestId,
        },
        { status: 500 },
      );
    }
  };
}

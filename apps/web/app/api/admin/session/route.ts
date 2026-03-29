import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  clearFailedLoginAttempts,
  createAdminSessionToken,
  getAdminSessionCookieOptions,
  getLoginThrottleState,
  registerFailedLoginAttempt,
  sanitizeAdminNextPath,
  verifyAdminPassword,
} from "@/lib/admin-auth";
import { extractClientIp, hashClientIp, recordAdminAudit } from "@/lib/telemetry";
import { withRouteTelemetry } from "@/lib/telemetry-route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POSTHandler = async (request: NextRequest) => {
  const body = (await request.json().catch(() => null)) as { password?: string; next?: string } | null;
  const password = body?.password?.trim() ?? "";
  const nextPath = sanitizeAdminNextPath(body?.next);
  const ipHash = hashClientIp(extractClientIp(request));
  const throttleKey = ipHash ?? "unknown";
  const throttle = getLoginThrottleState(throttleKey);

  if (!throttle.allowed) {
    await recordAdminAudit({
      timestamp: new Date().toISOString(),
      action: "admin.login",
      outcome: "failure",
      ipHash,
      detail: `throttled:${throttle.retryAfterSeconds}s`,
      requestId: request.headers.get("x-request-id"),
    });

    return NextResponse.json(
      { error: "Too many failed attempts", retry_after_seconds: throttle.retryAfterSeconds },
      { status: 429 },
    );
  }

  if (!verifyAdminPassword(password)) {
    registerFailedLoginAttempt(throttleKey);
    await recordAdminAudit({
      timestamp: new Date().toISOString(),
      action: "admin.login",
      outcome: "failure",
      ipHash,
      detail: "invalid-password",
      requestId: request.headers.get("x-request-id"),
    });

    return NextResponse.json({ error: "Invalid admin password" }, { status: 401 });
  }

  clearFailedLoginAttempts(throttleKey);

  const response = NextResponse.json({ authenticated: true, next: nextPath });
  response.cookies.set(ADMIN_SESSION_COOKIE, createAdminSessionToken(), getAdminSessionCookieOptions());

  await recordAdminAudit({
    timestamp: new Date().toISOString(),
    action: "admin.login",
    outcome: "success",
    ipHash,
    detail: nextPath,
    requestId: request.headers.get("x-request-id"),
  });

  return response;
};

const DELETEHandler = async (request: NextRequest) => {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", { ...getAdminSessionCookieOptions(), maxAge: 0 });

  await recordAdminAudit({
    timestamp: new Date().toISOString(),
    action: "admin.logout",
    outcome: "success",
    ipHash: hashClientIp(extractClientIp(request)),
    detail: null,
    requestId: request.headers.get("x-request-id"),
  });

  return response;
};

export const POST = withRouteTelemetry("admin.session.create", POSTHandler);
export const DELETE = withRouteTelemetry("admin.session.delete", DELETEHandler);

import "server-only";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

if (typeof window !== "undefined" && process.env.NODE_ENV !== "test") {
  throw new Error("lib/admin-auth.ts is server-only");
}

export const ADMIN_SESSION_COOKIE = "aiwf_admin_session";

const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;

type LoginWindowState = {
  count: number;
  windowStart: number;
};

export type AdminSession = {
  sub: "admin";
  exp: number;
  nonce: string;
};

type AdminRouteHandlerContext = { params: Promise<Record<string, string>> };

type AdminRouteHandlerWithoutContext<TRequest extends Request = Request> = (
  request: TRequest,
) => Promise<Response>;

type AdminRouteHandlerWithContext<
  TRequest extends Request = Request,
  TContext = AdminRouteHandlerContext,
> = (request: TRequest, context: TContext) => Promise<Response>;

type AdminRouteHandler<TRequest extends Request = Request, TContext = AdminRouteHandlerContext> =
  | AdminRouteHandlerWithoutContext<TRequest>
  | AdminRouteHandlerWithContext<TRequest, TContext>;

const loginAttempts = new Map<string, LoginWindowState>();

function getRequiredSecret(name: "AIWF_ADMIN_PASSWORD" | "AIWF_ADMIN_SESSION_SECRET"): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} must be configured to use the admin panel`);
  }

  return value;
}

function encodePayload(session: AdminSession): string {
  return Buffer.from(JSON.stringify(session), "utf-8").toString("base64url");
}

function decodePayload(encoded: string): AdminSession | null {
  try {
    const decoded = Buffer.from(encoded, "base64url").toString("utf-8");
    const parsed = JSON.parse(decoded) as Partial<AdminSession>;

    if (
      parsed.sub !== "admin" ||
      typeof parsed.exp !== "number" ||
      typeof parsed.nonce !== "string"
    ) {
      return null;
    }

    return {
      sub: "admin",
      exp: parsed.exp,
      nonce: parsed.nonce,
    };
  } catch {
    return null;
  }
}

function signPayload(payload: string): string {
  return createHmac("sha256", getRequiredSecret("AIWF_ADMIN_SESSION_SECRET"))
    .update(payload)
    .digest("base64url");
}

function hashText(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function compareSecret(input: string, expected: string): boolean {
  const left = hashText(input);
  const right = hashText(expected);
  return timingSafeEqual(left, right);
}

export function verifyAdminPassword(password: string): boolean {
  if (!password) {
    return false;
  }

  return compareSecret(password, getRequiredSecret("AIWF_ADMIN_PASSWORD"));
}

export function createAdminSessionToken(now = Date.now()): string {
  const payload = encodePayload({
    sub: "admin",
    exp: now + ADMIN_SESSION_MAX_AGE_SECONDS * 1000,
    nonce: randomUUID(),
  });

  return `${payload}.${signPayload(payload)}`;
}

export function verifyAdminSessionToken(token: string | null | undefined): AdminSession | null {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(payload);
  if (!compareSecret(signature, expectedSignature)) {
    return null;
  }

  const session = decodePayload(payload);
  if (!session || session.exp <= Date.now()) {
    return null;
  }

  return session;
}

function parseCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  const prefix = `${name}=`;
  for (const segment of cookieHeader.split(";")) {
    const value = segment.trim();
    if (value.startsWith(prefix)) {
      return decodeURIComponent(value.slice(prefix.length));
    }
  }

  return null;
}

export function getAdminSessionFromRequest(request: Request): AdminSession | null {
  return verifyAdminSessionToken(
    parseCookieValue(request.headers.get("cookie"), ADMIN_SESSION_COOKIE),
  );
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  return verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSession();

  if (!session) {
    redirect("/admin/login");
  }

  return session;
}

export function getAdminSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  };
}

export function unauthorizedAdminResponse() {
  return NextResponse.json({ error: "Admin authentication required" }, { status: 401 });
}

export function assertAdminRequest(request: Request): NextResponse | null {
  return getAdminSessionFromRequest(request) ? null : unauthorizedAdminResponse();
}

export function withAdminRouteGuard<TRequest extends Request = Request>(
  handler: AdminRouteHandlerWithoutContext<TRequest>,
): AdminRouteHandlerWithoutContext<TRequest>;

export function withAdminRouteGuard<
  TRequest extends Request = Request,
  TContext = AdminRouteHandlerContext,
>(
  handler: AdminRouteHandlerWithContext<TRequest, TContext>,
): AdminRouteHandlerWithContext<TRequest, TContext>;

export function withAdminRouteGuard<
  TRequest extends Request = Request,
  TContext = AdminRouteHandlerContext,
>(handler: AdminRouteHandler<TRequest, TContext>) {
  return async (request: TRequest, context?: TContext): Promise<Response> => {
    const session = getAdminSessionFromRequest(request);
    if (!session) {
      return unauthorizedAdminResponse();
    }

    return context === undefined
      ? await (handler as AdminRouteHandlerWithoutContext<TRequest>)(request)
      : await (handler as AdminRouteHandlerWithContext<TRequest, TContext>)(request, context);
  };
}

export function sanitizeAdminNextPath(nextPath: string | null | undefined): string {
  if (!nextPath) {
    return "/admin";
  }

  const candidate = nextPath.trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return "/admin";
  }

  try {
    const baseUrl = new URL("http://localhost");
    const parsed = new URL(candidate, baseUrl);

    if (parsed.origin !== baseUrl.origin || !parsed.pathname.startsWith("/")) {
      return "/admin";
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/admin";
  }
}

export function getLoginThrottleState(key: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const current = loginAttempts.get(key);

  if (!current || now - current.windowStart > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { count: 0, windowStart: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= LOGIN_MAX_ATTEMPTS) {
    const remainingMs = LOGIN_WINDOW_MS - (now - current.windowStart);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function registerFailedLoginAttempt(key: string): void {
  const now = Date.now();
  const current = loginAttempts.get(key);

  if (!current || now - current.windowStart > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, windowStart: now });
    return;
  }

  current.count += 1;
  loginAttempts.set(key, current);
}

export function clearFailedLoginAttempts(key: string): void {
  loginAttempts.delete(key);
}

import { NextRequest, NextResponse } from "next/server";
import { isMarkdownPreferred, rewritePath } from "fumadocs-core/negotiation";

const ADMIN_SESSION_COOKIE = "aiwf_session_token";

const { rewrite: rewriteLLM } = rewritePath("/docs/*path", "/llms.mdx/*path");

function hasAdminSessionCookie(request: NextRequest): boolean {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return false;
  }

  return cookieHeader
    .split(";")
    .some((segment) => segment.trim().startsWith(`${ADMIN_SESSION_COOKIE}=`));
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const hasAdminSession = hasAdminSessionCookie(request);
  const isDevelopment = process.env.NODE_ENV !== "production";
  const nonce = btoa(crypto.randomUUID());
  const requestHeaders = new Headers(request.headers);
  if (!isDevelopment) {
    requestHeaders.set("x-nonce", nonce);
  }

  let response: NextResponse;

  // Admin API routes rely on withBetterAuthAdminGuard for role checks; require a session cookie here.
  if (pathname.startsWith("/api/admin/")) {
    if (!hasAdminSession) {
      response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    } else {
      response = NextResponse.next({ request: { headers: requestHeaders } });
    }
  } else if (
    (pathname === "/admin" || pathname.startsWith("/admin/")) &&
    pathname !== "/admin/login"
  ) {
    if (!hasAdminSession) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      response = NextResponse.redirect(loginUrl);
    } else {
      response = NextResponse.next({ request: { headers: requestHeaders } });
    }
  } else if (pathname === "/admin/login" && hasAdminSession) {
    response = NextResponse.redirect(new URL("/admin", request.url));
  } else if (isMarkdownPreferred(request)) {
    const result = rewriteLLM(request.nextUrl.pathname);
    if (result) {
      response = NextResponse.rewrite(new URL(result, request.nextUrl), {
        request: { headers: requestHeaders },
      });
    } else {
      response = NextResponse.next({ request: { headers: requestHeaders } });
    }
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  const csp = [
    "default-src 'self'",
    isDevelopment
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https: wss:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);
  if (!isDevelopment) {
    response.headers.set("x-nonce", nonce);
  }

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

export const config = {
  matcher: ["/api/admin/:path*", "/((?!api|_next/static|_next/image|favicon.ico|llms).*)"],
};

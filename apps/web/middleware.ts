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

  let response: NextResponse;

  // Protect /admin routes - redirect to login if no session cookie
  if ((pathname === "/admin" || pathname.startsWith("/admin/")) && pathname !== "/admin/login") {
    if (!hasAdminSession) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      response = NextResponse.redirect(loginUrl);
    } else {
      response = NextResponse.next();
    }
  } else if (pathname === "/admin/login" && hasAdminSession) {
    response = NextResponse.redirect(new URL("/admin", request.url));
  } else if (isMarkdownPreferred(request)) {
    const result = rewriteLLM(request.nextUrl.pathname);
    if (result) {
      response = NextResponse.rewrite(new URL(result, request.nextUrl));
    } else {
      response = NextResponse.next();
    }
  } else {
    response = NextResponse.next();
  }

  // Canonical nonce-based CSP for Next.js 15 App Router.
  // This allows our dynamic inline JsonLd <script type="application/ld+json"> without
  // 'unsafe-inline' or 'unsafe-eval' on script-src.
  // Nonce is generated per-request (only possible in middleware) and exposed to Server
  // Components via the 'x-nonce' header so they can forward it to <JsonLd nonce={...} />.
  //
  // style-src still requires 'unsafe-inline' because Tailwind 4, Fumadocs UI, shadcn/ui,
  // katex, and tw-animate-css emit style rules that are not practical to nonce at this time.
  //
  // connect-src is intentionally broad for now (covers same-origin APIs, future WS,
  // OAuth provider callbacks, and remote feed images). It can be further scoped once
  // reader real-time and any additional third-party origins are finalized.
  //
  // img-src allows https: because article content comes from arbitrary external feeds.
  const nonce = btoa(crypto.randomUUID());

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https: wss:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-nonce", nonce);

  // Static security headers (also set here so they apply to redirects/rewrites).
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|llms).*)"],
};

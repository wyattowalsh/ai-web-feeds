import { NextRequest, NextResponse } from "next/server";
import { isMarkdownPreferred, rewritePath } from "fumadocs-core/negotiation";
import { hasValidAdminSession } from "@/lib/admin-auth-edge";

const { rewrite: rewriteLLM } = rewritePath("/docs/*path", "/llms.mdx/*path");

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const hasAdminSession = await hasValidAdminSession(request);

  // Protect /admin routes - redirect to login if no session
  if ((pathname === "/admin" || pathname.startsWith("/admin/")) && pathname !== "/admin/login") {
    if (!hasAdminSession) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Redirect /admin/login to dashboard if already authenticated
  if (pathname === "/admin/login" && hasAdminSession) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  // Rewrite markdown requests (AI agents)
  if (isMarkdownPreferred(request)) {
    const result = rewriteLLM(request.nextUrl.pathname);
    if (result) {
      return NextResponse.rewrite(new URL(result, request.nextUrl));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|llms).*)"],
};

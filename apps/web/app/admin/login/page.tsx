import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { hasBetterAuthSessionCookie } from "@/lib/auth-session-cookie";

export const dynamic = "force-dynamic";

function sanitizeAdminNextPath(next?: string): string {
  if (!next) {
    return "/admin";
  }

  // Only allow relative paths within /admin
  if (!next.startsWith("/admin")) {
    return "/admin";
  }

  return next;
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const requestHeaders = await headers();
  let session = null;
  if (hasBetterAuthSessionCookie(requestHeaders.get("cookie"))) {
    const { auth } = await import("@/lib/auth");
    session = await auth.api
      .getSession({
        headers: requestHeaders,
      })
      .catch(() => null);
  }

  if (session?.user) {
    redirect("/admin");
  }

  const params = await searchParams;
  const nextPath = sanitizeAdminNextPath(params.next);

  return (
    <div className="page-wrap page-stack">
      <section className="flex min-h-[70vh] items-center justify-center">
        <AdminLoginForm nextPath={nextPath} />
      </section>
    </div>
  );
}

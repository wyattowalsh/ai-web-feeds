import Link from "next/link";
import { ActivitySquare } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin-auth-new";
import { AdminLogoutButton } from "@/components/admin/admin-logout-button";

export const dynamic = "force-dynamic";

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({
    headers: requestHeaders,
  });

  if (!session?.user || !isAdminUser(session.user)) {
    redirect("/admin/login");
  }

  return (
    <div className="page-wrap page-stack">
      <section className="surface-panel space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-(--line) pb-6">
          <div className="space-y-3">
            <span className="eyebrow">
              <ActivitySquare className="size-3.5" />
              Admin observability
            </span>
            <div className="space-y-2">
              <h1 className="hero-title max-w-4xl">
                Protected telemetry and operational signals for the web API layer.
              </h1>
              <p className="hero-copy max-w-2xl">
                This surface is restricted to signed admin sessions and focuses on route-level
                latency, failure visibility, and audit traces.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin"
              className="rounded-2xl border border-(--line) px-4 py-2.5 text-sm font-medium text-(--ink) transition hover:bg-(--brand-soft)"
            >
              Overview
            </Link>
            <AdminLogoutButton />
          </div>
        </div>

        {children}
      </section>
    </div>
  );
}

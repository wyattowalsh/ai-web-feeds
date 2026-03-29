import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { getAdminSession, sanitizeAdminNextPath } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getAdminSession();
  if (session) {
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

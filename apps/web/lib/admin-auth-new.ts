import { auth } from "@/lib/auth";

export async function withBetterAuthAdminGuard(
  request: Request,
): Promise<{ user: { id: string; email: string; role: string } | null }> {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    if (!session?.user) {
      return { user: null };
    }
    return { user: session.user as { id: string; email: string; role: string } };
  } catch (error) {
    // Log at debug level to avoid leaking auth internals in production.
    console.debug("Admin guard session check failed:", error);
    return { user: null };
  }
}

export function isAdminUser(user: { role?: string } | null): boolean {
  return user?.role === "admin";
}

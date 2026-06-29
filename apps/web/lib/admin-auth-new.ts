export type AdminGuardUser = { id: string; email: string; role: string };

export type AdminGuardResult =
  | { status: "ok"; user: AdminGuardUser }
  | { status: "unauthorized" }
  | { status: "forbidden" };

export async function withBetterAuthAdminGuard(request: Request): Promise<AdminGuardResult> {
  try {
    const { auth } = await import("@/lib/auth");
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    if (!session?.user) {
      return { status: "unauthorized" };
    }

    const user = session.user as unknown as AdminGuardUser;
    if (!isAdminUser(user)) {
      return { status: "forbidden" };
    }

    return { status: "ok", user };
  } catch (error) {
    // Log at debug level to avoid leaking auth internals in production.
    console.debug("Admin guard session check failed:", error);
    return { status: "unauthorized" };
  }
}

export function isAdminUser(user: { role?: string } | null): boolean {
  return user?.role === "admin";
}

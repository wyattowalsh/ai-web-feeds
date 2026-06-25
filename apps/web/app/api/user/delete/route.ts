/**
 * DELETE /api/user/delete - Remove synced user data for the authenticated session
 */

import { NextResponse } from "next/server";
import { DatabaseNotConfiguredError } from "@/lib/server/db";
import { deleteUserData } from "@/lib/server/user-store/delete-user-data";
import { withRouteTelemetry } from "@/lib/telemetry-route";
import { getUserIdentity } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

const DELETEHandler = async (request: Request) => {
  try {
    const identity = await getUserIdentity(request);

    if (identity.source !== "session") {
      return NextResponse.json(
        { error: "Deleting synced data requires an authenticated session" },
        { status: 401 },
      );
    }

    const result = await deleteUserData(identity.user_id);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return NextResponse.json(
        { error: "User data deletion is unavailable until DATABASE_URL is configured." },
        { status: 503 },
      );
    }

    throw error;
  }
};

export const DELETE = withRouteTelemetry("user.delete", DELETEHandler);

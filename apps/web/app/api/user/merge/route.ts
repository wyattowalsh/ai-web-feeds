/**
 * Anonymous-to-authenticated account merge API
 *
 * POST /api/user/merge - Move anonymous browser data into the signed-in account
 */

import { NextRequest, NextResponse } from "next/server";
import { DatabaseNotConfiguredError } from "@/lib/server/db";
import { userStore } from "@/lib/server/user-store";
import { withRouteTelemetry } from "@/lib/telemetry-route";
import {
  getAnonymousBindingUserId,
  getUserIdentity,
  isValidUserId,
  validateUserOwnership,
} from "@/lib/user-auth";
import { recordSyncEvent } from "@/lib/server/sync-events";

export const dynamic = "force-dynamic";

const POSTHandler = async (request: NextRequest) => {
  try {
    const body = (await request.json()) as {
      from_user_id?: string;
      to_user_id?: string;
    };
    const identity = await getUserIdentity(request, body.to_user_id ?? null);

    if (identity.source !== "session") {
      return NextResponse.json(
        { error: "Account merge requires an authenticated session" },
        { status: 401 },
      );
    }

    const fromUserId = body.from_user_id?.trim();
    const toUserId = body.to_user_id?.trim() || identity.user_id;

    if (!fromUserId || !isValidUserId(fromUserId)) {
      return NextResponse.json({ error: "Missing or invalid from_user_id" }, { status: 400 });
    }

    if (!validateUserOwnership(toUserId, identity)) {
      return NextResponse.json(
        { error: "to_user_id does not match request identity" },
        { status: 403 },
      );
    }

    if (fromUserId === toUserId) {
      return NextResponse.json(
        { error: "from_user_id and to_user_id must differ" },
        { status: 400 },
      );
    }

    const boundAnonUserId = getAnonymousBindingUserId(request);
    if (!boundAnonUserId || boundAnonUserId !== fromUserId) {
      return NextResponse.json(
        { error: "from_user_id must match the anonymous binding cookie" },
        { status: 403 },
      );
    }

    const result = await userStore.merge.mergeAnonymousData({
      from_user_id: fromUserId,
      to_user_id: toUserId,
    });

    try {
      await recordSyncEvent({
        user_id: toUserId,
        event_type: "account.merge",
        entity_type: "user",
        entity_id: fromUserId,
        payload: { merged: result.merged },
      });
    } catch {
      // Sync telemetry must not block account merge.
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return NextResponse.json(
        { error: "Account merge is unavailable until DATABASE_URL is configured." },
        { status: 503 },
      );
    }

    if (error instanceof Error && error.message.includes("must differ")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    throw error;
  }
};

export const POST = withRouteTelemetry("user.merge", POSTHandler);

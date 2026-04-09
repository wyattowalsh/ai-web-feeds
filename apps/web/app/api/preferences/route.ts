/**
 * Notification preferences API
 *
 * GET /api/preferences - Get user preferences
 * POST /api/preferences - Create/update preference
 */

import { NextRequest, NextResponse } from "next/server";
import { withRouteTelemetry } from "@/lib/telemetry-route";
import {
  applyUserIdentityBinding,
  isValidUserId,
  resolveUserIdentity,
  validateTrustedUserOwnership,
} from "@/lib/user-auth";
import { fetchBackend, formatBackendErrorResponse, getBackendErrorStatus } from "@/lib/backend";

export const dynamic = "force-dynamic";

const GETHandler = async (request: NextRequest) => {
  const requestedUserId = request.nextUrl.searchParams.get("user_id");
  if (requestedUserId && !isValidUserId(requestedUserId)) {
    return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
  }

  const resolvedIdentity = resolveUserIdentity(request, requestedUserId);
  const { identity } = resolvedIdentity;

  if (requestedUserId && !validateTrustedUserOwnership(requestedUserId, identity)) {
    return NextResponse.json({ error: "user_id does not match request identity" }, { status: 403 });
  }

  try {
    const data = await fetchBackend("/storage/preferences", {
      method: "GET",
      params: {
        user_id: identity.user_id,
      },
    });

    const response = NextResponse.json({
      user_id: identity.user_id,
      preferences: data,
    });
    applyUserIdentityBinding(response, resolvedIdentity);
    return response;
  } catch (error) {
    return NextResponse.json(formatBackendErrorResponse(error), {
      status: getBackendErrorStatus(error),
    });
  }
};

const POSTHandler = async (request: NextRequest) => {
  try {
    const body = (await request.json()) as {
      user_id?: string;
      feed_id?: string | null;
      delivery_method?: string;
      frequency?: string;
      quiet_hours_start?: string | null;
      quiet_hours_end?: string | null;
    };
    if (body.user_id && !isValidUserId(body.user_id)) {
      return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
    }

    const resolvedIdentity = resolveUserIdentity(request, body.user_id ?? null);
    const { identity } = resolvedIdentity;
    const { feed_id, delivery_method, frequency, quiet_hours_start, quiet_hours_end } = body;

    if (body.user_id && !validateTrustedUserOwnership(body.user_id, identity)) {
      return NextResponse.json(
        { error: "user_id does not match request identity" },
        { status: 403 },
      );
    }

    const validDeliveryMethods = ["websocket", "email", "in_app"];
    const validFrequencies = ["instant", "hourly", "daily", "weekly", "off"];

    if (!delivery_method || !validDeliveryMethods.includes(delivery_method)) {
      return NextResponse.json(
        { error: `Invalid delivery_method. Must be one of: ${validDeliveryMethods.join(", ")}` },
        { status: 400 },
      );
    }

    if (!frequency || !validFrequencies.includes(frequency)) {
      return NextResponse.json(
        { error: `Invalid frequency. Must be one of: ${validFrequencies.join(", ")}` },
        { status: 400 },
      );
    }

    const data = await fetchBackend("/storage/preferences", {
      method: "POST",
      body: {
        user_id: identity.user_id,
        feed_id: feed_id || null,
        delivery_method,
        frequency,
        quiet_hours_start: quiet_hours_start || null,
        quiet_hours_end: quiet_hours_end || null,
      },
    });

    const response = NextResponse.json({
      success: true,
      preference: data,
    });
    applyUserIdentityBinding(response, resolvedIdentity);
    return response;
  } catch (error) {
    return NextResponse.json(formatBackendErrorResponse(error), {
      status: getBackendErrorStatus(error),
    });
  }
};

export const GET = withRouteTelemetry("preferences.list", GETHandler, {
  backendTarget: "python-backend",
});
export const POST = withRouteTelemetry("preferences.save", POSTHandler, {
  backendTarget: "python-backend",
});

/**
 * Feed follows API
 *
 * GET /api/follows - Get feeds followed by user
 * POST /api/follows - Follow a feed
 * DELETE /api/follows - Unfollow a feed
 *
 * Anonymous browser features use a stable client-generated UUID as user_id.
 */

import { NextRequest, NextResponse } from "next/server";
import { withRouteTelemetry } from "@/lib/telemetry-route";
import { getUserIdentity, validateUserOwnership } from "@/lib/user-auth";
import { fetchBackend, formatBackendErrorResponse } from "@/lib/backend";

export const dynamic = "force-dynamic";

const GETHandler = async (request: NextRequest) => {
  const requestedUserId = request.nextUrl.searchParams.get("user_id");
  const identity = getUserIdentity(request, requestedUserId);

  if (requestedUserId && identity.source === "anonymous") {
    return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
  }

  if (requestedUserId && !validateUserOwnership(requestedUserId, identity)) {
    return NextResponse.json({ error: "user_id does not match request identity" }, { status: 403 });
  }

  if (identity.source === "anonymous") {
    return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
  }

  try {
    const data = await fetchBackend("/storage/follows", {
      method: "GET",
      params: {
        user_id: identity.user_id,
      },
    });

    return NextResponse.json({
      user_id: identity.user_id,
      follows: data,
      count: Array.isArray(data) ? data.length : 0,
    });
  } catch (error) {
    return NextResponse.json(formatBackendErrorResponse(error), { status: 500 });
  }
};

const POSTHandler = async (request: NextRequest) => {
  let body: { user_id?: string; feed_id?: string } | undefined;
  let identity = getUserIdentity(request);

  try {
    body = (await request.json()) as { user_id?: string; feed_id?: string };
    identity = getUserIdentity(request, body.user_id ?? null);
    const { feed_id } = body;

    if (body.user_id && identity.source === "anonymous") {
      return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
    }

    if (body.user_id && !validateUserOwnership(body.user_id, identity)) {
      return NextResponse.json(
        { error: "user_id does not match request identity" },
        { status: 403 },
      );
    }

    if (identity.source === "anonymous") {
      return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
    }

    if (!feed_id) {
      return NextResponse.json({ error: "Missing required field: feed_id" }, { status: 400 });
    }

    const data = await fetchBackend("/storage/follows", {
      method: "POST",
      body: {
        user_id: identity.user_id,
        feed_id,
      },
    });

    return NextResponse.json({
      success: true,
      follow: data,
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "status" in error && error.status === 409) {
      return NextResponse.json({
        success: true,
        already_following: true,
        user_id: identity.user_id,
        feed_id: body?.feed_id,
      });
    }

    return NextResponse.json(formatBackendErrorResponse(error), { status: 500 });
  }
};

const DELETEHandler = async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const feedId = searchParams.get("feed_id");
  const requestedUserId = searchParams.get("user_id");
  const identity = getUserIdentity(request, requestedUserId);

  if (requestedUserId && identity.source === "anonymous") {
    return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
  }

  if (requestedUserId && !validateUserOwnership(requestedUserId, identity)) {
    return NextResponse.json({ error: "user_id does not match request identity" }, { status: 403 });
  }

  if (identity.source === "anonymous") {
    return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
  }

  if (!feedId) {
    return NextResponse.json({ error: "Missing required parameter: feed_id" }, { status: 400 });
  }

  try {
    await fetchBackend("/storage/follows", {
      method: "DELETE",
      params: {
        user_id: identity.user_id,
        feed_id: feedId,
      },
    });

    return NextResponse.json({
      success: true,
      user_id: identity.user_id,
      feed_id: feedId,
    });
  } catch (error) {
    return NextResponse.json(formatBackendErrorResponse(error), { status: 500 });
  }
};

export const GET = withRouteTelemetry("follows.list", GETHandler, {
  backendTarget: "python-backend",
});
export const POST = withRouteTelemetry("follows.create", POSTHandler, {
  backendTarget: "python-backend",
});
export const DELETE = withRouteTelemetry("follows.delete", DELETEHandler, {
  backendTarget: "python-backend",
});

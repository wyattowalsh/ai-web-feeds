/**
 * Source follows API
 *
 * GET /api/follows - Get sources followed by user
 * POST /api/follows - Follow a source
 * DELETE /api/follows - Unfollow a source
 *
 * Anonymous browser features use a stable client-generated UUID as user_id.
 */

import { NextRequest, NextResponse } from "next/server";
import { DatabaseNotConfiguredError } from "@/lib/server/db";
import { userStore } from "@/lib/server/user-store";
import { withRouteTelemetry } from "@/lib/telemetry-route";
import { getUserIdentity, validateUserOwnership } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

const GETHandler = async (request: NextRequest) => {
  const requestedUserId = request.nextUrl.searchParams.get("user_id");
  const identity = await getUserIdentity(request, requestedUserId);

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
    const data = await userStore.follows.list(identity.user_id);

    return NextResponse.json({
      user_id: identity.user_id,
      follows: data,
      count: data.length,
    });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return NextResponse.json(
        { error: "Source follows are unavailable until DATABASE_URL is configured." },
        { status: 503 },
      );
    }

    throw error;
  }
};

const POSTHandler = async (request: NextRequest) => {
  let body: { user_id?: string; source_id?: string } | undefined;
  let identity = await getUserIdentity(request);

  try {
    body = (await request.json()) as { user_id?: string; source_id?: string };
    identity = await getUserIdentity(request, body.user_id ?? null);
    const { source_id } = body;

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

    if (!source_id) {
      return NextResponse.json({ error: "Missing required field: source_id" }, { status: 400 });
    }

    const result = await userStore.follows.follow(identity.user_id, source_id);
    if (!result.created) {
      return NextResponse.json({
        success: true,
        already_following: true,
        user_id: identity.user_id,
        source_id,
      });
    }

    return NextResponse.json({
      success: true,
      follow: result.follow,
    });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return NextResponse.json(
        { error: "Source follows are unavailable until DATABASE_URL is configured." },
        { status: 503 },
      );
    }

    throw error;
  }
};

const DELETEHandler = async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const sourceId = searchParams.get("source_id");
  const requestedUserId = searchParams.get("user_id");
  const identity = await getUserIdentity(request, requestedUserId);

  if (requestedUserId && identity.source === "anonymous") {
    return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
  }

  if (requestedUserId && !validateUserOwnership(requestedUserId, identity)) {
    return NextResponse.json({ error: "user_id does not match request identity" }, { status: 403 });
  }

  if (identity.source === "anonymous") {
    return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
  }

  if (!sourceId) {
    return NextResponse.json({ error: "Missing required parameter: source_id" }, { status: 400 });
  }

  try {
    const removed = await userStore.follows.unfollow(identity.user_id, sourceId);
    if (!removed) {
      return NextResponse.json({ error: "Follow not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user_id: identity.user_id,
      source_id: sourceId,
    });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return NextResponse.json(
        { error: "Source follows are unavailable until DATABASE_URL is configured." },
        { status: 503 },
      );
    }

    throw error;
  }
};

export const GET = withRouteTelemetry("follows.list", GETHandler);
export const POST = withRouteTelemetry("follows.create", POSTHandler);
export const DELETE = withRouteTelemetry("follows.delete", DELETEHandler);

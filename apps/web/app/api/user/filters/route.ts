/**
 * Saved reader filters API
 *
 * GET /api/user/filters - List saved reader filters
 * POST /api/user/filters - Create or update a saved filter
 * DELETE /api/user/filters - Delete a saved filter
 */

import { NextRequest, NextResponse } from "next/server";
import { DatabaseNotConfiguredError } from "@/lib/server/db";
import { normalizeSavedReaderFilterPayload } from "@/lib/server/contracts/reader-filter";
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
    const filters = await userStore.readerFilters.list(identity.user_id);

    return NextResponse.json({
      user_id: identity.user_id,
      filters,
      count: filters.length,
    });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return NextResponse.json(
        { error: "Saved reader filters are unavailable until DATABASE_URL is configured." },
        { status: 503 },
      );
    }

    throw error;
  }
};

const POSTHandler = async (request: NextRequest) => {
  try {
    const body = (await request.json()) as {
      user_id?: string;
      filter_name?: string;
      payload?: Record<string, unknown>;
      pinned?: boolean;
      is_default?: boolean;
    };
    const identity = await getUserIdentity(request, body.user_id ?? null);
    const { filter_name, payload, pinned, is_default } = body;

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

    if (!filter_name?.trim()) {
      return NextResponse.json({ error: "Missing required field: filter_name" }, { status: 400 });
    }

    const saved = await userStore.readerFilters.save({
      user_id: identity.user_id,
      filter_name: filter_name.trim(),
      payload: normalizeSavedReaderFilterPayload(payload),
      pinned,
      is_default,
    });

    return NextResponse.json({
      success: true,
      filter: saved,
    });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return NextResponse.json(
        { error: "Saved reader filters are unavailable until DATABASE_URL is configured." },
        { status: 503 },
      );
    }

    throw error;
  }
};

const DELETEHandler = async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const filterId = searchParams.get("id");
  const requestedUserId = searchParams.get("user_id");
  const identity = await getUserIdentity(request, requestedUserId);

  if (!filterId) {
    return NextResponse.json({ error: "Missing required parameter: id" }, { status: 400 });
  }

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
    const deleted = await userStore.readerFilters.delete(identity.user_id, filterId);
    if (!deleted) {
      return NextResponse.json({ error: "Saved reader filter not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      id: filterId,
    });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return NextResponse.json(
        { error: "Saved reader filters are unavailable until DATABASE_URL is configured." },
        { status: 503 },
      );
    }

    throw error;
  }
};

export const GET = withRouteTelemetry("user.filters.list", GETHandler);
export const POST = withRouteTelemetry("user.filters.save", POSTHandler);
export const DELETE = withRouteTelemetry("user.filters.delete", DELETEHandler);

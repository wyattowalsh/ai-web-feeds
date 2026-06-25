import { NextResponse } from "next/server";
import { DatabaseNotConfiguredError } from "@/lib/server/db";
import { userStore } from "@/lib/server/user-store";
import { withRouteTelemetry } from "@/lib/telemetry-route";
import { getUserIdentity, validateUserOwnership } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

const GETHandler = async (request: Request) => {
  const { searchParams } = new URL(request.url);
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

  try {
    const data = await userStore.savedSearches.list(identity.user_id);

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return NextResponse.json(
        { error: "Saved searches are unavailable until DATABASE_URL is configured." },
        { status: 503 },
      );
    }

    throw error;
  }
};

const POSTHandler = async (request: Request) => {
  try {
    const body = (await request.json()) as {
      user_id?: string;
      search_name?: string;
      query_text?: string;
      filters?: Record<string, unknown>;
    };
    const identity = await getUserIdentity(request, body.user_id ?? null);

    if (body.user_id && identity.source === "anonymous") {
      return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
    }

    if (body.user_id && !validateUserOwnership(body.user_id, identity)) {
      return NextResponse.json(
        { error: "user_id does not match request identity" },
        { status: 403 },
      );
    }

    const { search_name, query_text, filters } = body;

    if (identity.source === "anonymous") {
      return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
    }

    if (!search_name || !query_text) {
      return NextResponse.json(
        { error: "Missing required fields: search_name, query_text" },
        { status: 400 },
      );
    }

    const data = await userStore.savedSearches.create({
      user_id: identity.user_id,
      search_name,
      query_text,
      filters: filters || {},
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return NextResponse.json(
        { error: "Saved searches are unavailable until DATABASE_URL is configured." },
        { status: 503 },
      );
    }

    throw error;
  }
};

const DELETEHandler = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const search_id = searchParams.get("id");
  const requestedUserId = searchParams.get("user_id");
  const identity = await getUserIdentity(request, requestedUserId);

  if (!search_id) {
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
    const deleted = await userStore.savedSearches.delete(identity.user_id, search_id);
    if (!deleted) {
      return NextResponse.json({ error: "Saved search not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, id: search_id });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return NextResponse.json(
        { error: "Saved searches are unavailable until DATABASE_URL is configured." },
        { status: 503 },
      );
    }

    throw error;
  }
};

export const GET = withRouteTelemetry("search.saved.list", GETHandler);
export const POST = withRouteTelemetry("search.saved.create", POSTHandler);
export const DELETE = withRouteTelemetry("search.saved.delete", DELETEHandler);

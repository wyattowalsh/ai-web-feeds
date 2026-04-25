import { NextResponse } from "next/server";
import { withRouteTelemetry } from "@/lib/telemetry-route";
import { getUserIdentity, validateUserOwnership } from "@/lib/user-auth";
import { BackendError, fetchBackend, formatBackendErrorResponse } from "@/lib/backend";

export const dynamic = "force-dynamic";

function getBackendErrorStatus(error: unknown): number {
  return error instanceof BackendError ? error.status : 500;
}

const GETHandler = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const requestedUserId = searchParams.get("user_id");
  const identity = getUserIdentity(request, requestedUserId);

  try {
    if (requestedUserId && identity.source === "anonymous") {
      return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
    }

    if (requestedUserId && !validateUserOwnership(requestedUserId, identity)) {
      return NextResponse.json(
        { error: "user_id does not match request identity" },
        { status: 403 },
      );
    }

    if (identity.source === "anonymous") {
      return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
    }

    const data = await fetchBackend("/storage/saved_searches", {
      method: "GET",
      params: {
        user_id: identity.user_id,
      },
    });

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (error) {
    return NextResponse.json(formatBackendErrorResponse(error), {
      status: getBackendErrorStatus(error),
    });
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
    const identity = getUserIdentity(request, body.user_id ?? null);

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

    const data = await fetchBackend("/storage/saved_searches", {
      method: "POST",
      body: {
        user_id: identity.user_id,
        search_name,
        query_text,
        filters: filters || {},
      },
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(formatBackendErrorResponse(error), {
      status: getBackendErrorStatus(error),
    });
  }
};

const DELETEHandler = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const search_id = searchParams.get("id");
  const requestedUserId = searchParams.get("user_id");
  const identity = getUserIdentity(request, requestedUserId);

  if (!search_id) {
    return NextResponse.json({ error: "Missing required parameter: id" }, { status: 400 });
  }

  try {
    if (requestedUserId && identity.source === "anonymous") {
      return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
    }

    if (requestedUserId && !validateUserOwnership(requestedUserId, identity)) {
      return NextResponse.json(
        { error: "user_id does not match request identity" },
        { status: 403 },
      );
    }

    if (identity.source === "anonymous") {
      return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
    }

    const data = await fetchBackend(`/storage/saved_searches/${search_id}`, {
      method: "DELETE",
      params: {
        user_id: identity.user_id,
      },
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(formatBackendErrorResponse(error), {
      status: getBackendErrorStatus(error),
    });
  }
};

export const GET = withRouteTelemetry("search.saved.list", GETHandler, {
  backendTarget: "python-backend",
});
export const POST = withRouteTelemetry("search.saved.create", POSTHandler, {
  backendTarget: "python-backend",
});
export const DELETE = withRouteTelemetry("search.saved.delete", DELETEHandler, {
  backendTarget: "python-backend",
});

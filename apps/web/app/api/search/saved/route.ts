import { NextResponse } from "next/server";
import { withRouteTelemetry } from "@/lib/telemetry-route";
import {
  applyUserIdentityBinding,
  isValidUserId,
  resolveUserIdentity,
  validateTrustedUserOwnership,
} from "@/lib/user-auth";
import {
  BackendConfigurationError,
  BackendError,
  fetchBackend,
  formatBackendErrorResponse,
} from "@/lib/backend";
import { normalizeSearchFilters, normalizeSearchQuery } from "@/lib/search";

export const dynamic = "force-dynamic";

const SAVED_SEARCHES_UNAVAILABLE_MESSAGE =
  "Saved searches are unavailable because search storage is not configured for this environment.";

function createSavedSearchesUnavailablePayload() {
  return {
    error: SAVED_SEARCHES_UNAVAILABLE_MESSAGE,
    code: "BACKEND_UNAVAILABLE",
  } as const;
}

function getBackendErrorStatus(error: unknown): number {
  if (error instanceof BackendConfigurationError) {
    return 503;
  }

  return error instanceof BackendError ? error.status : 500;
}

const GETHandler = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const requestedUserId = searchParams.get("user_id");
  if (requestedUserId && !isValidUserId(requestedUserId)) {
    return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
  }
  const resolvedIdentity = resolveUserIdentity(request, requestedUserId);
  const { identity } = resolvedIdentity;

  if (requestedUserId && !validateTrustedUserOwnership(requestedUserId, identity)) {
    return NextResponse.json({ error: "user_id does not match request identity" }, { status: 403 });
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

    const data = await fetchBackend("/storage/saved_searches", {
      method: "GET",
      params: {
        user_id: identity.user_id,
      },
    });

    const response = NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, no-cache",
      },
    });
    applyUserIdentityBinding(response, resolvedIdentity);
    return response;
  } catch (error) {
    return NextResponse.json(formatBackendErrorResponse(error), {
      status: getBackendErrorStatus(error),
    });
  }
};

const POSTHandler = async (request: Request) => {
  let resolvedIdentity = resolveUserIdentity(request);

  try {
    const body = (await request.json()) as {
      user_id?: string;
      search_name?: string;
      query_text?: string;
      filters?: Record<string, unknown>;
    };
    if (body.user_id && !isValidUserId(body.user_id)) {
      return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
    }
    resolvedIdentity = resolveUserIdentity(request, body.user_id ?? null);
    const { identity } = resolvedIdentity;

    if (body.user_id && !validateUserOwnership(body.user_id, identity)) {
      return NextResponse.json(
        { error: "user_id does not match request identity" },
        { status: 403 },
      );
    }

    const search_name = body.search_name?.trim();
    const query_text = normalizeSearchQuery(body.query_text);
    const filters = normalizeSearchFilters(body.filters);

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
        filters,
      },
    });

    const response = NextResponse.json(data, { status: 201 });
    applyUserIdentityBinding(response, resolvedIdentity);
    return response;
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
  if (requestedUserId && !isValidUserId(requestedUserId)) {
    return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
  }
  const resolvedIdentity = resolveUserIdentity(request, requestedUserId);
  const { identity } = resolvedIdentity;

  if (requestedUserId && !validateTrustedUserOwnership(requestedUserId, identity)) {
    return NextResponse.json({ error: "user_id does not match request identity" }, { status: 403 });
  }

  if (!search_id) {
    return NextResponse.json({ error: "Missing required parameter: id" }, { status: 400 });
  }

  const encodedSearchId = encodeURIComponent(search_id);

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

    const response = NextResponse.json(data);
    applyUserIdentityBinding(response, resolvedIdentity);
    return response;
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

import { NextResponse } from "next/server";
import { withRouteTelemetry } from "@/lib/telemetry-route";
import {
  BackendConfigurationError,
  clampNumber,
  createFeatureUnavailableResponse,
  fetchBackend,
  formatBackendErrorResponse,
  getBackendErrorStatus,
} from "@/lib/backend";

export const dynamic = "force-dynamic";

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

  const seed_topics = searchParams.get("topics")?.split(",").filter(Boolean) || undefined;
  const userId = searchParams.get("user_id")?.trim() || undefined;
  const limit = clampNumber(parseInt(searchParams.get("limit") || "20", 10), 1, 100);

  try {
    const data = await fetchBackend("/recommendations", {
      method: "GET",
      params: {
        limit,
        ...(userId && { user_id: userId }),
        ...(seed_topics && { topics: seed_topics.join(",") }),
      },
    });

    const response = NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, s-maxage=300, stale-while-revalidate=600",
      },
    });
    applyUserIdentityBinding(response, resolvedIdentity);
    return response;
  } catch (error) {
    if (error instanceof BackendConfigurationError) {
      return NextResponse.json(
        createFeatureUnavailableResponse(
          "Recommendations",
          "Recommendations are unavailable until BACKEND_URL points to the ai-web-feeds backend.",
        ),
        { status: 503 },
      );
    }

    return NextResponse.json(formatBackendErrorResponse(error), {
      status: getBackendErrorStatus(error),
    });
  }
};

const POSTHandler = async (request: Request) => {
  let body: {
    user_id?: string;
    feed_id?: string;
    interaction_type?: string;
    reason?: string;
  } | null = null;
  let resolvedIdentity = resolveUserIdentity(request);

  try {
    const body = await request.json();
    const userId = typeof body?.user_id === "string" ? body.user_id.trim() : "";
    const feedId = typeof body?.feed_id === "string" ? body.feed_id.trim() : "";
    const interactionType =
      typeof body?.interaction_type === "string" ? body.interaction_type.trim() : "";
    const reason = typeof body?.reason === "string" ? body.reason : null;

    if (!userId || !feedId || !interactionType) {
      return NextResponse.json(
        { error: "Missing required fields: user_id, feed_id, interaction_type" },
        { status: 400 },
      );
    }

    const valid_interactions = ["view", "click", "subscribe", "dismiss"];
    if (!valid_interactions.includes(interactionType)) {
      return NextResponse.json(
        { error: `Invalid interaction_type. Must be one of: ${valid_interactions.join(", ")}` },
        { status: 400 },
      );
    }

    const data = await fetchBackend("/recommendations/interactions", {
      method: "POST",
      body: {
        user_id: userId,
        feed_id: feedId,
        interaction_type: interactionType,
        reason,
      },
    });

    const response = NextResponse.json(data);
    applyUserIdentityBinding(response, resolvedIdentity);
    return response;
  } catch (error) {
    if (error instanceof BackendConfigurationError) {
      return NextResponse.json(
        createFeatureUnavailableResponse(
          "Recommendations",
          "Recommendations are unavailable until BACKEND_URL points to the ai-web-feeds backend.",
        ),
        { status: 503 },
      );
    }

    return NextResponse.json(formatBackendErrorResponse(error), {
      status: getBackendErrorStatus(error),
    });
  }
};

export const GET = withRouteTelemetry("recommendations.list", GETHandler, {
  backendTarget: "python-backend",
});
export const POST = withRouteTelemetry("recommendations.interaction", POSTHandler, {
  backendTarget: "python-backend",
});

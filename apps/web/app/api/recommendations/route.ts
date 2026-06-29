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
import { DatabaseNotConfiguredError, getSql } from "@/lib/server/db";
import { recordRecommendationInteraction } from "@/lib/server/recommendation-interactions";
import { getUserIdentity, validateUserOwnership } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

const GETHandler = async (request: Request) => {
  const { searchParams } = new URL(request.url);

  const seed_topics = searchParams.get("topics")?.split(",").filter(Boolean) || undefined;
  const requestedUserId = searchParams.get("user_id")?.trim() || undefined;
  const limit = clampNumber(parseInt(searchParams.get("limit") || "20", 10), 1, 100);

  const identity = await getUserIdentity(request, requestedUserId ?? null);

  if (requestedUserId && identity.source === "anonymous") {
    return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
  }

  if (requestedUserId && !validateUserOwnership(requestedUserId, identity)) {
    return NextResponse.json({ error: "user_id does not match request identity" }, { status: 403 });
  }

  const userId = identity.source !== "anonymous" ? identity.user_id : requestedUserId;

  try {
    const data = await fetchBackend("/recommendations", {
      method: "GET",
      params: {
        limit,
        ...(userId && { user_id: userId }),
        ...(seed_topics && { topics: seed_topics.join(",") }),
      },
    });

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, s-maxage=300, stale-while-revalidate=600",
      },
    });
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
  try {
    const body = await request.json();
    const requestedUserId = typeof body?.user_id === "string" ? body.user_id.trim() : "";
    const feedId = typeof body?.feed_id === "string" ? body.feed_id.trim() : "";
    const interactionType =
      typeof body?.interaction_type === "string" ? body.interaction_type.trim() : "";
    const reason = typeof body?.reason === "string" ? body.reason : null;

    const identity = await getUserIdentity(request, requestedUserId || null);

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

    const userId = identity.user_id;

    if (!feedId || !interactionType) {
      return NextResponse.json(
        { error: "Missing required fields: feed_id, interaction_type" },
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

    if (getSql()) {
      try {
        const record = await recordRecommendationInteraction({
          user_id: userId,
          feed_id: feedId,
          interaction_type: interactionType,
          reason,
        });

        return NextResponse.json({
          tracked: true,
          id: record.id,
          interaction_type: record.interaction_type,
        });
      } catch (error) {
        if (error instanceof DatabaseNotConfiguredError) {
          return NextResponse.json(
            createFeatureUnavailableResponse(
              "Recommendations",
              "Recommendation interactions are unavailable until DATABASE_URL is configured.",
            ),
            { status: 503 },
          );
        }

        throw error;
      }
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

    return NextResponse.json(data);
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
  backendTarget: "neon-or-python-backend",
});

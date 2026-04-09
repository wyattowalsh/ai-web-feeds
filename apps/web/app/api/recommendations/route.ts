import { NextResponse } from "next/server";
import { withRouteTelemetry } from "@/lib/telemetry-route";
import {
  applyUserIdentityBinding,
  isValidUserId,
  resolveUserIdentity,
  validateTrustedUserOwnership,
} from "@/lib/user-auth";
import {
  clampNumber,
  fetchBackend,
  getBackendErrorStatus,
  formatBackendErrorResponse,
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
  const limit = clampNumber(parseInt(searchParams.get("limit") || "20", 10), 1, 100);

  try {
    const data = await fetchBackend("/recommendations", {
      method: "GET",
      params: {
        limit,
        user_id: identity.user_id,
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
    body = (await request.json()) as {
      user_id?: string;
      feed_id?: string;
      interaction_type?: string;
      reason?: string;
    };
    if (body.user_id && !isValidUserId(body.user_id)) {
      return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
    }
    resolvedIdentity = resolveUserIdentity(request, body.user_id ?? null);
    const { identity } = resolvedIdentity;
    const { feed_id, interaction_type, reason } = body;

    if (body.user_id && !validateTrustedUserOwnership(body.user_id, identity)) {
      return NextResponse.json(
        { error: "user_id does not match request identity" },
        { status: 403 },
      );
    }

    if (!feed_id || !interaction_type) {
      return NextResponse.json(
        { error: "Missing required fields: feed_id, interaction_type" },
        { status: 400 },
      );
    }

    const valid_interactions = ["view", "click", "subscribe", "dismiss"];
    if (!valid_interactions.includes(interaction_type)) {
      return NextResponse.json(
        { error: `Invalid interaction_type. Must be one of: ${valid_interactions.join(", ")}` },
        { status: 400 },
      );
    }

    const data = await fetchBackend("/recommendations/interactions", {
      method: "POST",
      body: {
        user_id: identity.user_id,
        feed_id,
        interaction_type,
        reason: reason || null,
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

export const GET = withRouteTelemetry("recommendations.list", GETHandler, {
  backendTarget: "python-backend",
});
export const POST = withRouteTelemetry("recommendations.interaction", POSTHandler, {
  backendTarget: "python-backend",
});

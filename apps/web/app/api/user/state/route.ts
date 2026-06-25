/**
 * User article state API
 *
 * GET /api/user/state - List article triage state for sync
 * POST /api/user/state - Upsert one or more article states
 */

import { NextRequest, NextResponse } from "next/server";
import { clampNumber } from "@/lib/backend";
import { DatabaseNotConfiguredError } from "@/lib/server/db";
import { toClientArticleState, userStore } from "@/lib/server/user-store";
import type { UpsertArticleStateInput } from "@/lib/server/user-store";
import { withRouteTelemetry } from "@/lib/telemetry-route";
import { recordSyncEvent } from "@/lib/server/sync-events";
import { getUserIdentity, validateUserOwnership } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

function parseStateInput(
  value: Record<string, unknown>,
): Omit<UpsertArticleStateInput, "user_id"> | null {
  const articleKey = typeof value.article_key === "string" ? value.article_key.trim() : "";
  if (!articleKey) {
    return null;
  }

  return {
    article_key: articleKey,
    read: typeof value.read === "boolean" ? value.read : undefined,
    starred: typeof value.starred === "boolean" ? value.starred : undefined,
    archived: typeof value.archived === "boolean" ? value.archived : undefined,
    bookmarked: typeof value.bookmarked === "boolean" ? value.bookmarked : undefined,
    read_duration_ms:
      typeof value.read_duration_ms === "number" ? value.read_duration_ms : undefined,
    scroll_depth: typeof value.scroll_depth === "number" ? value.scroll_depth : undefined,
    opened_from: typeof value.opened_from === "string" ? value.opened_from : undefined,
  };
}

const GETHandler = async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const requestedUserId = searchParams.get("user_id");
  const identity = await getUserIdentity(request, requestedUserId);
  const since = searchParams.get("since");
  const limit = clampNumber(parseInt(searchParams.get("limit") || "500", 10), 1, 5000);

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
    const records = await userStore.articleStates.list(identity.user_id, {
      since: since ?? undefined,
      limit,
    });
    const states = records.map((record) => toClientArticleState(record));

    return NextResponse.json({
      user_id: identity.user_id,
      states,
      count: states.length,
    });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return NextResponse.json(
        { error: "Article state sync is unavailable until DATABASE_URL is configured." },
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
      article_key?: string;
      read?: boolean;
      starred?: boolean;
      archived?: boolean;
      bookmarked?: boolean;
      read_duration_ms?: number | null;
      scroll_depth?: number | null;
      opened_from?: string | null;
      states?: Array<Record<string, unknown>>;
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

    if (identity.source === "anonymous") {
      return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
    }

    const batchInputs = Array.isArray(body.states)
      ? body.states
          .map((state) => parseStateInput(state))
          .filter((state): state is Omit<UpsertArticleStateInput, "user_id"> => state != null)
      : [];

    if (batchInputs.length > 0) {
      const result = await userStore.articleStates.upsertMany(identity.user_id, batchInputs);

      try {
        await recordSyncEvent({
          user_id: identity.user_id,
          event_type: "article_state.batch_upsert",
          entity_type: "article_state",
          entity_id: identity.user_id,
          payload: { upserted: result.upserted },
        });
      } catch {
        // Sync telemetry must not block article state writes.
      }

      return NextResponse.json({
        success: true,
        user_id: identity.user_id,
        upserted: result.upserted,
        states: result.states.map((record) => toClientArticleState(record)),
      });
    }

    const singleInput = parseStateInput(body as Record<string, unknown>);
    if (!singleInput) {
      return NextResponse.json(
        { error: "Missing required field: article_key or states[]" },
        { status: 400 },
      );
    }

    const saved = await userStore.articleStates.upsert({
      user_id: identity.user_id,
      ...singleInput,
    });

    try {
      await recordSyncEvent({
        user_id: identity.user_id,
        event_type: "article_state.upsert",
        entity_type: "article_state",
        entity_id: singleInput.article_key,
        payload: { read: singleInput.read, starred: singleInput.starred },
      });
    } catch {
      // Sync telemetry must not block article state writes.
    }

    return NextResponse.json({
      success: true,
      user_id: identity.user_id,
      state: toClientArticleState(saved),
    });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return NextResponse.json(
        { error: "Article state sync is unavailable until DATABASE_URL is configured." },
        { status: 503 },
      );
    }

    throw error;
  }
};

export const GET = withRouteTelemetry("user.state.list", GETHandler);
export const POST = withRouteTelemetry("user.state.upsert", POSTHandler);

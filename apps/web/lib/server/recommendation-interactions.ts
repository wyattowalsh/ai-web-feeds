import "server-only";

import { assertDbConfigured } from "@/lib/server/db";

export type RecommendationInteractionInput = {
  user_id: string;
  feed_id: string;
  interaction_type: string;
  reason?: string | null;
};

export type RecommendationInteractionRecord = {
  id: string;
  user_id: string;
  feed_id: string;
  interaction_type: string;
  context: Record<string, unknown>;
  timestamp: string;
};

function mapInteractionRow(row: Record<string, unknown>): RecommendationInteractionRecord {
  const context =
    row.context && typeof row.context === "object" && !Array.isArray(row.context)
      ? (row.context as Record<string, unknown>)
      : {};

  return {
    id: String(row.id),
    user_id: String(row.user_id),
    feed_id: String(row.feed_id),
    interaction_type: String(row.interaction_type),
    context,
    timestamp:
      row.timestamp instanceof Date
        ? row.timestamp.toISOString()
        : typeof row.timestamp === "string"
          ? row.timestamp
          : new Date().toISOString(),
  };
}

export async function recordRecommendationInteraction(
  input: RecommendationInteractionInput,
): Promise<RecommendationInteractionRecord> {
  const sql = assertDbConfigured();
  const context = input.reason ? { reason: input.reason } : {};

  const rows = await sql`
    INSERT INTO recommendation_interactions (
      id,
      user_id,
      feed_id,
      interaction_type,
      context,
      timestamp
    )
    VALUES (
      gen_random_uuid(),
      ${input.user_id},
      ${input.feed_id},
      ${input.interaction_type},
      ${JSON.stringify(context)}::jsonb,
      NOW()
    )
    RETURNING id, user_id, feed_id, interaction_type, context, timestamp
  `;

  return mapInteractionRow(rows[0] as Record<string, unknown>);
}

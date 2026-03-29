import { NextResponse } from 'next/server';

import { loadAggregatedFeedPostsByIds } from '@/lib/feed-posts';
import { withRouteTelemetry } from '@/lib/telemetry-route';

export const dynamic = 'force-dynamic';

const POSTHandler = async (request: Request) => {
  const body = (await request.json().catch(() => null)) as
    | {
        feedIds?: string[];
        limit?: number;
        perFeedLimit?: number;
        refresh?: boolean;
      }
    | null;

  if (!Array.isArray(body?.feedIds) || body.feedIds.length === 0) {
    return NextResponse.json({ error: 'feedIds is required' }, { status: 400 });
  }

  const limit = clampNumber(body.limit, 1, 48, 24);
  const perFeedLimit = clampNumber(body.perFeedLimit, 1, 3, 2);

  try {
    const payload = await loadAggregatedFeedPostsByIds(body.feedIds, limit, perFeedLimit, {
      forceRefresh: body.refresh === true,
    });

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load aggregated feed posts';
    return NextResponse.json({ error: message }, { status: 502 });
  }
};

function clampNumber(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(value), min), max);
}

export const POST = withRouteTelemetry('feeds.posts.aggregate', POSTHandler);

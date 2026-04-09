import { NextResponse } from "next/server";
import { getAnalyticsSnapshot } from "@/lib/analytics-local";
import { withRouteTelemetry } from "@/lib/telemetry-route";

export const dynamic = "force-dynamic";

const GETHandler = async (request: Request) => {
  const { searchParams } = new URL(request.url);

  try {
    const snapshot = await getAnalyticsSnapshot(
      searchParams.get("date_range"),
      searchParams.get("topic"),
      searchParams.get("granularity"),
    );

    const rows = [
      ["section", "key", "value"],
      ["summary", "total_sources", String(snapshot.summary.total_sources)],
      ["summary", "active_sources", String(snapshot.summary.active_sources)],
      ["summary", "posts_last_24h", String(snapshot.summary.posts_last_24h)],
      ["summary", "posts_last_7d", String(snapshot.summary.posts_last_7d)],
      ["summary", "topic_count", String(snapshot.summary.topic_count)],
      [
        "summary",
        "total_recent_posts",
        String(snapshot.summary.velocity_overview.total_recent_posts),
      ],
      ["summary", "last_updated", snapshot.summary.last_updated],
      ...snapshot.summary.source_type_distribution.map((entry) => [
        "source_type_distribution",
        entry.source_type,
        String(entry.count),
      ]),
      ["scan_summary", "matching_sources", String(snapshot.summary.scan_summary.matching_sources)],
      ["scan_summary", "scanned_sources", String(snapshot.summary.scan_summary.scanned_sources)],
      ["scan_summary", "scan_limit", String(snapshot.summary.scan_summary.scan_limit)],
      ["scan_summary", "per_source_limit", String(snapshot.summary.scan_summary.per_source_limit)],
      ["scan_summary", "truncated", String(snapshot.summary.scan_summary.truncated)],
      ...snapshot.trending.map((topic) => [
        "trending_topic",
        topic.topic,
        JSON.stringify({
          feed_count: topic.feed_count,
          recent_post_count: topic.recent_post_count,
          share: topic.share,
        }),
      ]),
      ...snapshot.velocity.data_points.map((point) => [
        "velocity_point",
        point.date,
        String(point.count),
      ]),
    ];

    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replaceAll(`"`, `""`)}"`).join(","))
      .join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="analytics-export-${snapshot.summary.date_range}.csv"`,
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to export analytics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
};

export const GET = withRouteTelemetry("analytics.export", GETHandler);

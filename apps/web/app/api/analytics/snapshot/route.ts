import { NextResponse } from "next/server";
import { getFeedStats, loadFeedCatalog, type FeedSource } from "@/lib/feeds";
import {
  getDefaultValidationStats,
  getValidationStats,
  type ValidationStats,
} from "@/lib/validation-stats";
import { withRouteTelemetry } from "@/lib/telemetry-route";

export const dynamic = "force-dynamic";

type SnapshotBody = {
  demo: false;
  points: [];
  forecast_enabled?: false;
  total_feeds?: number;
  active_feeds?: number | null;
  verified_feeds?: number | null;
  topic_count?: number;
  source_type_count?: number;
  validated_feeds?: number;
  success_count?: number;
  failure_count?: number;
  success_rate?: number | null;
  avg_response_time_ms?: number | null;
  healthy_feeds?: number;
  avg_health_score?: number | null;
  last_validation_run?: string | null;
};

function readCatalogRows(): FeedSource[] {
  try {
    const catalog = loadFeedCatalog();
    return Array.isArray(catalog?.sources) ? catalog.sources : [];
  } catch {
    return [];
  }
}

async function readValidationSnapshot(): Promise<ValidationStats> {
  try {
    return await getValidationStats();
  } catch {
    return getDefaultValidationStats();
  }
}

function validationSummary(validation: ValidationStats): SnapshotBody {
  return {
    demo: false,
    points: [],
    forecast_enabled: false,
    total_feeds: validation.total_feeds,
    validated_feeds: validation.validated_feeds,
    success_count: validation.success_count,
    failure_count: validation.failure_count,
    success_rate: validation.success_rate,
    avg_response_time_ms: validation.avg_response_time_ms,
    healthy_feeds: validation.healthy_feeds,
    avg_health_score: validation.avg_health_score,
    last_validation_run: validation.last_validation_run,
  };
}

function catalogSummary(sources: FeedSource[], validation: ValidationStats): SnapshotBody {
  const stats = getFeedStats(sources);
  const summary: SnapshotBody = {
    demo: false,
    points: [],
    forecast_enabled: false,
    total_feeds: stats.total,
    active_feeds: stats.hasActivityMetadata ? stats.active : null,
    verified_feeds: stats.hasVerificationMetadata ? stats.verified : null,
    topic_count: stats.topicCount,
    source_type_count: stats.sourceTypeCount,
  };

  if (!validation.validation_data_available) {
    return summary;
  }

  summary.validated_feeds = validation.validated_feeds;
  summary.success_count = validation.success_count;
  summary.failure_count = validation.failure_count;
  summary.success_rate = validation.success_rate;
  summary.avg_response_time_ms = validation.avg_response_time_ms;
  summary.healthy_feeds = validation.healthy_feeds;
  summary.avg_health_score = validation.avg_health_score;
  summary.last_validation_run = validation.last_validation_run;
  return summary;
}

async function readAnalyticsSnapshot(): Promise<SnapshotBody> {
  const sources = readCatalogRows();
  const validation = await readValidationSnapshot();

  if (sources.length === 0 && !validation.validation_data_available) {
    return { demo: false, points: [] };
  }

  if (sources.length === 0) {
    return validationSummary(validation);
  }

  return catalogSummary(sources, validation);
}

const GETHandler = async () => {
  const body = await readAnalyticsSnapshot();

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "private, s-maxage=300, stale-while-revalidate=600",
    },
  });
};

const POSTHandler = async () => {
  const body = await readAnalyticsSnapshot();
  return NextResponse.json(body);
};

export const GET = withRouteTelemetry("analytics.snapshot.latest", GETHandler);
export const POST = withRouteTelemetry("analytics.snapshot.create", POSTHandler);

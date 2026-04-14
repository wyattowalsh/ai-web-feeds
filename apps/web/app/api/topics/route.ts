import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { parse } from "yaml";
import type { TopicRecord } from "@/lib/catalog-types";
import { withRouteTelemetry } from "@/lib/telemetry-route";

export const dynamic = "force-static";

const GETHandler = async () => {
  try {
    const topicsPath = join(process.cwd(), "../../data/topics.yaml");
    const content = readFileSync(topicsPath, "utf-8");
    const data = parse(content);

    // Extract the topics array from the YAML structure
    const topics: TopicRecord[] = Array.isArray(data?.topics) ? data.topics : [];

    return NextResponse.json(topics, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Error loading topics:", error);
    return NextResponse.json({ error: "Failed to load topics data" }, { status: 500 });
  }
};

export const GET = withRouteTelemetry("topics.list", GETHandler);

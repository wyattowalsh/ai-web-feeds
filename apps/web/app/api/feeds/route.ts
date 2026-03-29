import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { parse } from "yaml";
import type { CatalogFeed } from "@/lib/catalog-types";
import { withRouteTelemetry } from "@/lib/telemetry-route";

export const dynamic = "force-static";

const GETHandler = async (_request: Request) => {
  try {
    // Try enriched YAML first, fallback to feeds.yaml, then feeds.json
    let feedsPath = join(process.cwd(), "../../data/feeds.enriched.yaml");
    let content: string;
    let isJson = false;

    try {
      content = readFileSync(feedsPath, "utf-8");
      // If enriched file is empty, try regular feeds.yaml
      if (!content.trim()) {
        throw new Error("Empty file");
      }
    } catch {
      try {
        // Fallback to feeds.yaml
        feedsPath = join(process.cwd(), "../../data/feeds.yaml");
        content = readFileSync(feedsPath, "utf-8");
      } catch {
        // Final fallback to feeds.json
        feedsPath = join(process.cwd(), "../../data/feeds.json");
        content = readFileSync(feedsPath, "utf-8");
        isJson = true;
      }
    }

    const data = isJson ? JSON.parse(content) : parse(content);

    // Extract the feeds/sources array from the structure
    const feeds: CatalogFeed[] = Array.isArray(data?.sources)
      ? data.sources
      : Array.isArray(data?.feeds)
        ? data.feeds
        : Array.isArray(data)
          ? data
          : [];

    return NextResponse.json(feeds, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Error loading feeds:", error);
    return NextResponse.json({ error: "Failed to load feeds data" }, { status: 500 });
  }
};

export const GET = withRouteTelemetry("feeds.list", GETHandler);

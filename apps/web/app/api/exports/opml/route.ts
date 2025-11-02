import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-static";

/**
 * OPML export API endpoint
 * Returns OPML files for feed reader import
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "all"; // all, categorized, filtered
  const sourceType = searchParams.get("type");
  const topic = searchParams.get("topic");
  const verified = searchParams.get("verified");

  try {
    const dataDir = join(process.cwd(), "../../data");
    let opmlPath: string;
    let filename: string;

    // Determine which OPML file to serve
    if (format === "categorized") {
      opmlPath = join(dataDir, "categorized.opml");
      filename = "ai-ml-feeds-categorized.opml";
    } else if (format === "filtered" && (sourceType || topic || verified)) {
      // For filtered exports, we'd need to generate dynamically
      // For now, fallback to all.opml
      opmlPath = join(dataDir, "all.opml");
      filename = `ai-ml-feeds-filtered.opml`;
    } else {
      opmlPath = join(dataDir, "all.opml");
      filename = "ai-ml-feeds-all.opml";
    }

    // Read OPML file
    const opmlContent = readFileSync(opmlPath, "utf-8");

    return new NextResponse(opmlContent, {
      headers: {
        "Content-Type": "application/xml",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Error serving OPML:", error);
    return NextResponse.json({ error: "Failed to generate OPML file" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { withRouteTelemetry } from "@/lib/telemetry-route";
import { getUserIdentity } from "@/lib/user-auth";
import { fetchBackend, formatBackendErrorResponse, clampNumber } from "@/lib/backend";

export const dynamic = "force-dynamic";

interface SearchParams {
  q: string;
  type?: "full_text" | "semantic";
  limit?: number;
  source_type?: string;
  topics?: string;
  verified?: boolean;
  threshold?: number;
}

const GETHandler = async (request: Request) => {
  const { searchParams } = new URL(request.url);

  const query = searchParams.get("q");
  if (!query) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  const type = (searchParams.get("type") || "full_text") as "full_text" | "semantic";
  const limit = clampNumber(parseInt(searchParams.get("limit") || "20", 10), 1, 100);
  const source_type = searchParams.get("source_type") || undefined;
  const topics = searchParams.get("topics")?.split(",").filter(Boolean) || undefined;
  const verified = searchParams.get("verified") === "true" ? true : undefined;
  const threshold = Math.max(0, Math.min(1, parseFloat(searchParams.get("threshold") || "0.7")));

  try {
    const data = await fetchBackend("/search", {
      method: "GET",
      params: {
        q: query,
        type,
        limit,
        ...(source_type && { source_type }),
        ...(topics && { topics: topics.join(",") }),
        ...(verified !== undefined && { verified }),
        ...(threshold !== 0.7 && { threshold }),
      },
    });

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    return NextResponse.json(formatBackendErrorResponse(error), { status: 500 });
  }
};

const POSTHandler = async (request: Request) => {
  const identity = getUserIdentity(request);

  try {
    const body = await request.json();
    const { query, type, filters, clicked_results } = body;

    if (!query) {
      return NextResponse.json({ error: "Missing required field: query" }, { status: 400 });
    }

    const data = await fetchBackend("/search/log", {
      method: "POST",
      body: {
        query,
        type: type || "full_text",
        filters: filters || {},
        clicked_results: clicked_results || [],
        user_id: identity.source !== "anonymous" ? identity.user_id : null,
      },
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(formatBackendErrorResponse(error), { status: 500 });
  }
};

export const GET = withRouteTelemetry("search.query", GETHandler, {
  backendTarget: "python-backend",
});
export const POST = withRouteTelemetry("search.log", POSTHandler, {
  backendTarget: "python-backend",
});

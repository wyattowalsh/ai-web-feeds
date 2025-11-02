import { NextResponse } from "next/server";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const query = searchParams.get("q");
  if (!query) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  const type = (searchParams.get("type") || "full_text") as "full_text" | "semantic";
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const source_type = searchParams.get("source_type") || undefined;
  const topics = searchParams.get("topics")?.split(",") || undefined;
  const verified = searchParams.get("verified") === "true" ? true : undefined;
  const threshold = parseFloat(searchParams.get("threshold") || "0.7");

  try {
    // In production, this would call the Python backend search API
    // For now, we'll return mock data matching the schema

    // Generate mock results based on query
    const mockFeeds = [
      {
        id: "openai-blog",
        title: "OpenAI Blog",
        description: "Research updates from OpenAI",
        url: "https://openai.com/blog/feed.xml",
        topics: ["llm", "agents", "research"],
        source_type: "blog",
        verified: true,
        is_active: true,
        similarity: type === "semantic" ? 0.92 : undefined,
      },
      {
        id: "huggingface-blog",
        title: "Hugging Face Blog",
        description: "Latest ML models and datasets",
        url: "https://huggingface.co/blog/feed.xml",
        topics: ["llm", "training", "opensource"],
        source_type: "blog",
        verified: true,
        is_active: true,
        similarity: type === "semantic" ? 0.87 : undefined,
      },
      {
        id: "anthropic-blog",
        title: "Anthropic Blog",
        description: "AI safety and research",
        url: "https://anthropic.com/blog/feed.xml",
        topics: ["llm", "safety", "research"],
        source_type: "blog",
        verified: true,
        is_active: true,
        similarity: type === "semantic" ? 0.85 : undefined,
      },
      {
        id: "pytorch-blog",
        title: "PyTorch Blog",
        description: "PyTorch framework updates",
        url: "https://pytorch.org/blog/feed.xml",
        topics: ["training", "framework", "opensource"],
        source_type: "blog",
        verified: true,
        is_active: true,
        similarity: type === "semantic" ? 0.82 : undefined,
      },
    ];

    // Apply filters
    let results = mockFeeds.filter((feed) => {
      if (source_type && feed.source_type !== source_type) return false;
      if (topics && !topics.some((t) => feed.topics.includes(t))) return false;
      if (verified !== undefined && feed.verified !== verified) return false;
      if (type === "semantic" && feed.similarity && feed.similarity < threshold) return false;
      return true;
    });

    // Sort by similarity if semantic
    if (type === "semantic") {
      results.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
    }

    results = results.slice(0, limit);

    // Log search query (in production)
    // await logSearchQuery({ query, type, filters, result_count: results.length });

    return NextResponse.json(
      {
        query,
        type,
        results,
        total: results.length,
        filters: { source_type, topics, verified, threshold },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600", // 5 min cache
        },
      },
    );
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed. Please try again." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query, type, filters, clicked_results, user_id } = body;

    // In production, log search query with click tracking
    console.log("Search logged:", { query, type, filters, clicked_results, user_id });

    return NextResponse.json({ success: true, logged: true });
  } catch (error) {
    console.error("Search logging error:", error);
    return NextResponse.json({ error: "Failed to log search" }, { status: 500 });
  }
}

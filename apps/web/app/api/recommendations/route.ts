import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface RecommendationParams {
  user_id?: string;
  seed_topics?: string;
  limit?: number;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const user_id = searchParams.get("user_id") || undefined;
  const seed_topics = searchParams.get("topics")?.split(",") || undefined;
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  try {
    // In production, this would call the Python backend recommendations API
    // For now, we'll return mock recommendations

    const mockRecommendations = [
      {
        feed: {
          id: "deepmind-blog",
          title: "DeepMind Blog",
          description: "AI research from Google DeepMind",
          url: "https://deepmind.google/blog/feed/",
          topics: ["research", "agents", "rl"],
          source_type: "blog",
          verified: true,
          is_active: true,
        },
        score: 0.92,
        reason: "similar_topics",
      },
      {
        feed: {
          id: "meta-ai",
          title: "Meta AI Blog",
          description: "AI research from Meta",
          url: "https://ai.meta.com/blog/feed.xml",
          topics: ["llm", "research", "opensource"],
          source_type: "blog",
          verified: true,
          is_active: true,
        },
        score: 0.88,
        reason: "popular",
      },
      {
        feed: {
          id: "stabilityai",
          title: "Stability AI Blog",
          description: "Generative AI and diffusion models",
          url: "https://stability.ai/blog/feed/",
          topics: ["genai", "cv", "opensource"],
          source_type: "blog",
          verified: true,
          is_active: true,
        },
        score: 0.15,
        reason: "discover",
      },
    ];

    // Filter by topics if provided
    let results = mockRecommendations;
    if (seed_topics && seed_topics.length > 0) {
      results = mockRecommendations.filter((rec) =>
        rec.feed.topics.some((t) => seed_topics.includes(t)),
      );
    }

    results = results.slice(0, limit);

    return NextResponse.json(
      {
        recommendations: results,
        total: results.length,
        user_id,
        seed_topics,
      },
      {
        headers: {
          "Cache-Control": "private, s-maxage=300, stale-while-revalidate=600", // 5 min private cache
        },
      },
    );
  } catch (error) {
    console.error("Recommendations error:", error);
    return NextResponse.json({ error: "Failed to generate recommendations" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, feed_id, interaction_type, reason } = body;

    if (!user_id || !feed_id || !interaction_type) {
      return NextResponse.json(
        { error: "Missing required fields: user_id, feed_id, interaction_type" },
        { status: 400 },
      );
    }

    const valid_interactions = ["view", "click", "subscribe", "dismiss"];
    if (!valid_interactions.includes(interaction_type)) {
      return NextResponse.json(
        { error: `Invalid interaction_type. Must be one of: ${valid_interactions.join(", ")}` },
        { status: 400 },
      );
    }

    // In production, track interaction in database
    console.log("Tracked interaction:", { user_id, feed_id, interaction_type, reason });

    return NextResponse.json({ success: true, tracked: true });
  } catch (error) {
    console.error("Track interaction error:", error);
    return NextResponse.json({ error: "Failed to track interaction" }, { status: 500 });
  }
}

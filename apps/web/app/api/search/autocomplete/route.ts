import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const prefix = searchParams.get("prefix");
  if (!prefix || prefix.length < 2) {
    return NextResponse.json({
      feeds: [],
      topics: [],
    });
  }

  const limit = parseInt(searchParams.get("limit") || "8", 10);

  try {
    // In production, this would call the Python backend autocomplete API
    // For now, we'll return mock suggestions

    const mockFeeds = [
      { id: "openai-blog", title: "OpenAI Blog", type: "feed", url: "https://openai.com/blog" },
      {
        id: "huggingface",
        title: "Hugging Face Blog",
        type: "feed",
        url: "https://huggingface.co/blog",
      },
      { id: "pytorch", title: "PyTorch Blog", type: "feed", url: "https://pytorch.org/blog" },
      {
        id: "tensorflow",
        title: "TensorFlow Blog",
        type: "feed",
        url: "https://blog.tensorflow.org",
      },
      { id: "anthropic", title: "Anthropic Blog", type: "feed", url: "https://anthropic.com/blog" },
    ];

    const mockTopics = [
      { label: "LLM", type: "topic", feed_count: 245 },
      { label: "AGENTS", type: "topic", feed_count: 180 },
      { label: "TRAINING", type: "topic", feed_count: 165 },
      { label: "ML", type: "topic", feed_count: 298 },
      { label: "NLP", type: "topic", feed_count: 156 },
    ];

    // Filter by prefix (case-insensitive)
    const lowerPrefix = prefix.toLowerCase();

    const feeds = mockFeeds.filter((f) => f.title.toLowerCase().includes(lowerPrefix)).slice(0, 5);

    const topics = mockTopics
      .filter((t) => t.label.toLowerCase().includes(lowerPrefix))
      .slice(0, 3);

    return NextResponse.json(
      {
        feeds,
        topics,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120", // 1 min cache
        },
      },
    );
  } catch (error) {
    console.error("Autocomplete error:", error);
    return NextResponse.json({ error: "Autocomplete failed" }, { status: 500 });
  }
}

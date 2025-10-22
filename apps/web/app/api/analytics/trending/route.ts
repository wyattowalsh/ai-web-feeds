import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const date_range = searchParams.get('date_range') || '30d';

  try {
    // In production, this would call the Python backend API
    // For now, we'll return mock data matching the schema
    
    const trending_topics = [
      { topic: 'llm', feed_count: 245, validation_frequency: 89.5, avg_health_score: 0.92 },
      { topic: 'agents', feed_count: 180, validation_frequency: 76.2, avg_health_score: 0.88 },
      { topic: 'training', feed_count: 165, validation_frequency: 68.7, avg_health_score: 0.90 },
      { topic: 'inference', feed_count: 142, validation_frequency: 62.3, avg_health_score: 0.85 },
      { topic: 'genai', feed_count: 130, validation_frequency: 58.9, avg_health_score: 0.89 },
      { topic: 'ml', feed_count: 298, validation_frequency: 55.4, avg_health_score: 0.86 },
      { topic: 'cv', feed_count: 118, validation_frequency: 52.1, avg_health_score: 0.84 },
      { topic: 'nlp', feed_count: 156, validation_frequency: 49.8, avg_health_score: 0.87 },
      { topic: 'rl', feed_count: 89, validation_frequency: 42.5, avg_health_score: 0.82 },
      { topic: 'data', feed_count: 267, validation_frequency: 38.9, avg_health_score: 0.83 },
    ].slice(0, limit);

    return NextResponse.json(trending_topics, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', // 5 min cache
      },
    });
  } catch (error) {
    console.error('Error fetching trending topics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trending topics' },
      { status: 500 }
    );
  }
}


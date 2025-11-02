import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    // In production, this would trigger the Python backend snapshot generation
    // For now, we'll return a mock snapshot
    
    const snapshot = {
      snapshot_date: new Date().toISOString().split('T')[0],
      total_feeds: 1250,
      active_feeds: 1180,
      validation_success_rate: 0.94,
      avg_response_time: 285.5,
      trending_topics: [
        { topic: 'llm', feed_count: 245, validation_frequency: 89.5, avg_health_score: 0.92 },
        { topic: 'agents', feed_count: 180, validation_frequency: 76.2, avg_health_score: 0.88 },
        { topic: 'training', feed_count: 165, validation_frequency: 68.7, avg_health_score: 0.90 },
      ],
      health_distribution: {
        healthy: 940,
        moderate: 240,
        unhealthy: 70,
      },
      created_at: new Date().toISOString(),
    };

    return NextResponse.json(snapshot, { status: 201 });
  } catch (error) {
    console.error('Error generating analytics snapshot:', error);
    return NextResponse.json(
      { error: 'Failed to generate analytics snapshot' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Get latest snapshot
    const snapshot = {
      snapshot_date: new Date().toISOString().split('T')[0],
      total_feeds: 1250,
      active_feeds: 1180,
      validation_success_rate: 0.94,
      avg_response_time: 285.5,
      trending_topics: [
        { topic: 'llm', feed_count: 245, validation_frequency: 89.5, avg_health_score: 0.92 },
        { topic: 'agents', feed_count: 180, validation_frequency: 76.2, avg_health_score: 0.88 },
      ],
      health_distribution: {
        healthy: 940,
        moderate: 240,
        unhealthy: 70,
      },
      created_at: new Date().toISOString(),
    };

    return NextResponse.json(snapshot, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200', // 1 hour cache
      },
    });
  } catch (error) {
    console.error('Error fetching latest snapshot:', error);
    return NextResponse.json(
      { error: 'Failed to fetch latest snapshot' },
      { status: 500 }
    );
  }
}


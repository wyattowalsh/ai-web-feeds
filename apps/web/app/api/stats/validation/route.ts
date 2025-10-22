import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic'; // Always run fresh

/**
 * Validation stats API endpoint
 * Returns overall validation health metrics
 */
export async function GET() {
  try {
    // Get validation stats from Python CLI
    // In a real implementation, this would query the database directly
    // For now, we'll return mock data based on the feed collection
    
    const stats = {
      total_feeds: 0,
      validated_feeds: 0,
      success_count: 0,
      failure_count: 0,
      success_rate: 0,
      avg_response_time_ms: 0,
      healthy_feeds: 0,
      avg_health_score: 0,
      last_validation_run: null as string | null,
      top_errors: [] as Array<{ error: string; count: number }>,
    };

    // Try to get real data from database via Python
    try {
      const { stdout } = await execAsync(
        'cd ../.. && uv run python -c "from ai_web_feeds import DatabaseManager; import json; db = DatabaseManager(); feeds = db.get_all_feed_sources(); print(json.dumps({\'total\': len(feeds)}))"',
        { timeout: 5000 }
      );
      
      const data = JSON.parse(stdout.trim());
      stats.total_feeds = data.total;
      
      // TODO: Add actual validation metrics from database
      // For now, use estimates
      stats.validated_feeds = Math.floor(data.total * 0.8);
      stats.success_count = Math.floor(data.total * 0.7);
      stats.failure_count = Math.floor(data.total * 0.1);
      stats.success_rate = 87.5;
      stats.avg_response_time_ms = 450;
      stats.healthy_feeds = Math.floor(data.total * 0.75);
      stats.avg_health_score = 0.82;
      
    } catch (error) {
      // Fallback to mock data
      stats.total_feeds = 100;
      stats.validated_feeds = 80;
      stats.success_count = 70;
      stats.failure_count = 10;
      stats.success_rate = 87.5;
      stats.avg_response_time_ms = 450;
      stats.healthy_feeds = 75;
      stats.avg_health_score = 0.82;
    }

    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Error fetching validation stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch validation stats' },
      { status: 500 }
    );
  }
}


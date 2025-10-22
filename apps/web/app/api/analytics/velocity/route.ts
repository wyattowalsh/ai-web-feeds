import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const granularity = searchParams.get('granularity') || 'daily';
  const date_range = searchParams.get('date_range') || '30d';

  try {
    // Generate mock data based on granularity
    const generateDataPoints = () => {
      const points = [];
      const today = new Date();
      const days = date_range === '7d' ? 7 : date_range === '90d' ? 90 : 30;
      
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        let dateStr = '';
        if (granularity === 'daily') {
          dateStr = date.toISOString().split('T')[0];
        } else if (granularity === 'weekly') {
          const week = Math.ceil((date.getDate() + date.getDay()) / 7);
          dateStr = `${date.getFullYear()}-W${week.toString().padStart(2, '0')}`;
        } else {
          dateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        }
        
        // Random count between 800-1200
        const count = Math.floor(Math.random() * 400) + 800;
        
        points.push({ date: dateStr, count });
      }
      
      return points;
    };

    const velocity = {
      granularity,
      data_points: generateDataPoints(),
      avg_per_feed: 2.4,
      most_active_feed: {
        id: 'openai-blog',
        title: 'OpenAI Blog',
        count: 45,
      },
      least_active_feed: {
        id: 'some-inactive',
        title: 'Rarely Updated Blog',
        count: 1,
      },
    };

    return NextResponse.json(velocity, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', // 5 min cache
      },
    });
  } catch (error) {
    console.error('Error fetching publication velocity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch publication velocity' },
      { status: 500 }
    );
  }
}


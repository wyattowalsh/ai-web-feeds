import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';

export const dynamic = 'force-static';

export async function GET() {
  try {
    const topicsPath = join(process.cwd(), '../../data/topics.yaml');
    const content = readFileSync(topicsPath, 'utf-8');
    const data = parse(content);
    
    // Extract the topics array from the YAML structure
    const topics = data.topics || [];
    
    return NextResponse.json(topics, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Error loading topics:', error);
    return NextResponse.json(
      { error: 'Failed to load topics data' },
      { status: 500 }
    );
  }
}

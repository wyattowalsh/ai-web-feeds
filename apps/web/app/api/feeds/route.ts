import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';

export const dynamic = 'force-static';

export async function GET() {
  try {
    // Try enriched YAML first, fallback to feeds.yaml, then feeds.json
    let feedsPath = join(process.cwd(), '../../data/feeds.enriched.yaml');
    let content: string;
    let isJson = false;
    
    try {
      content = readFileSync(feedsPath, 'utf-8');
      // If enriched file is empty, try regular feeds.yaml
      if (!content.trim()) {
        throw new Error('Empty file');
      }
    } catch {
      try {
        // Fallback to feeds.yaml
        feedsPath = join(process.cwd(), '../../data/feeds.yaml');
        content = readFileSync(feedsPath, 'utf-8');
      } catch {
        // Final fallback to feeds.json
        feedsPath = join(process.cwd(), '../../data/feeds.json');
        content = readFileSync(feedsPath, 'utf-8');
        isJson = true;
      }
    }
    
    const data = isJson ? JSON.parse(content) : parse(content);
    
    // Extract the feeds/sources array from the structure
    const feeds = data.sources || data.feeds || (Array.isArray(data) ? data : []);
    
    return NextResponse.json(feeds, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Error loading feeds:', error);
    return NextResponse.json(
      { error: 'Failed to load feeds data' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Mock storage for saved searches (in production, this would use database)
const savedSearches = new Map<string, any[]>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const user_id = searchParams.get('user_id') || 'anonymous';

  try {
    const searches = savedSearches.get(user_id) || [];

    return NextResponse.json(searches, {
      headers: {
        'Cache-Control': 'private, no-cache', // User-specific, don't cache
      },
    });
  } catch (error) {
    console.error('Get saved searches error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve saved searches' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, search_name, query_text, filters } = body;

    if (!user_id || !search_name || !query_text) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, search_name, query_text' },
        { status: 400 }
      );
    }

    // Create saved search
    const savedSearch = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      user_id,
      search_name,
      query_text,
      filters: filters || {},
      created_at: new Date().toISOString(),
      last_used_at: new Date().toISOString(),
    };

    // Save to mock storage
    const userSearches = savedSearches.get(user_id) || [];
    userSearches.push(savedSearch);
    savedSearches.set(user_id, userSearches);

    return NextResponse.json(savedSearch, { status: 201 });
  } catch (error) {
    console.error('Save search error:', error);
    return NextResponse.json(
      { error: 'Failed to save search' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const search_id = searchParams.get('id');
  const user_id = searchParams.get('user_id');

  if (!search_id || !user_id) {
    return NextResponse.json(
      { error: 'Missing required parameters: id, user_id' },
      { status: 400 }
    );
  }

  try {
    const userSearches = savedSearches.get(user_id) || [];
    const filtered = userSearches.filter((s) => s.id !== search_id);
    savedSearches.set(user_id, filtered);

    return NextResponse.json({ success: true, deleted: search_id });
  } catch (error) {
    console.error('Delete saved search error:', error);
    return NextResponse.json(
      { error: 'Failed to delete saved search' },
      { status: 500 }
    );
  }
}


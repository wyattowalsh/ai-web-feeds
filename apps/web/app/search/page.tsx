'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { SearchBar } from '@/components/search/search-bar';
import { SearchFilters } from '@/components/search/search-filters';
import { SearchResults } from '@/components/search/search-results';
import { SavedSearches } from '@/components/search/saved-searches';

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  url: string;
  topics: string[];
  source_type: string;
  verified: boolean;
  is_active: boolean;
  similarity?: number;
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Search state
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [searchType, setSearchType] = useState<'full_text' | 'semantic'>(
    (searchParams.get('type') as 'full_text' | 'semantic') || 'full_text'
  );
  const [sourceType, setSourceType] = useState<string | undefined>(
    searchParams.get('source_type') || undefined
  );
  const [topics, setTopics] = useState<string[]>(
    searchParams.get('topics')?.split(',').filter(Boolean) || []
  );
  const [verified, setVerified] = useState<boolean | undefined>(
    searchParams.get('verified') === 'true' ? true : undefined
  );
  const [threshold, setThreshold] = useState(
    parseFloat(searchParams.get('threshold') || '0.7')
  );

  // Results state
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // User ID (localStorage for Phase 1)
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    // Get or create user ID from localStorage
    let id = localStorage.getItem('search_user_id');
    if (!id) {
      id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('search_user_id', id);
    }
    setUserId(id);

    // Perform search if query is in URL
    if (searchParams.get('q')) {
      performSearch(searchParams.get('q')!);
    }
  }, []);

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setHasSearched(true);

    // Update URL
    const params = new URLSearchParams();
    params.set('q', searchQuery);
    params.set('type', searchType);
    if (sourceType) params.set('source_type', sourceType);
    if (topics.length > 0) params.set('topics', topics.join(','));
    if (verified !== undefined) params.set('verified', String(verified));
    if (searchType === 'semantic') params.set('threshold', String(threshold));

    router.push(`/search?${params.toString()}`);

    try {
      const response = await fetch(`/api/search?${params.toString()}`);
      if (!response.ok) throw new Error('Search failed');

      const data = await response.json();
      setResults(data.results || []);

      // Log search
      await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          type: searchType,
          filters: { source_type: sourceType, topics, verified, threshold },
          clicked_results: [],
          user_id: userId,
        }),
      });
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (newQuery: string) => {
    setQuery(newQuery);
    performSearch(newQuery);
  };

  const handleLoadSavedSearch = (savedQuery: string, savedFilters: Record<string, any>) => {
    setQuery(savedQuery);
    if (savedFilters.source_type) setSourceType(savedFilters.source_type);
    if (savedFilters.topics) setTopics(savedFilters.topics);
    if (savedFilters.verified !== undefined) setVerified(savedFilters.verified);
    performSearch(savedQuery);
  };

  const handleResultClick = async (feedId: string) => {
    // Log click for analytics
    await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        type: searchType,
        filters: { source_type: sourceType, topics, verified, threshold },
        clicked_results: [feedId],
        user_id: userId,
      }),
    });
  };

  const handleSaveSearch = async () => {
    const name = prompt('Enter a name for this search:');
    if (!name) return;

    try {
      await fetch('/api/search/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          search_name: name,
          query_text: query,
          filters: { source_type: sourceType, topics, verified, threshold },
        }),
      });
      alert('Search saved successfully!');
    } catch (error) {
      console.error('Failed to save search:', error);
      alert('Failed to save search. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Search & Discovery
          </h1>
          <p className="text-gray-600">
            Find feeds with full-text or semantic search, powered by SQLite FTS5 and embeddings
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <SearchBar onSearch={handleSearch} initialQuery={query} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar: Filters + Saved Searches */}
          <div className="lg:col-span-1 space-y-6">
            <SearchFilters
              searchType={searchType}
              onSearchTypeChange={setSearchType}
              sourceType={sourceType}
              onSourceTypeChange={setSourceType}
              topics={topics}
              onTopicsChange={setTopics}
              verified={verified}
              onVerifiedChange={setVerified}
              threshold={threshold}
              onThresholdChange={setThreshold}
            />

            {userId && (
              <SavedSearches userId={userId} onLoadSearch={handleLoadSavedSearch} />
            )}
          </div>

          {/* Main: Results */}
          <div className="lg:col-span-3">
            {hasSearched && query && (
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Showing results for: <strong>{query}</strong>
                </p>
                {results.length > 0 && (
                  <button
                    onClick={handleSaveSearch}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    💾 Save Search
                  </button>
                )}
              </div>
            )}

            <SearchResults
              results={results}
              searchType={searchType}
              loading={loading}
              onResultClick={handleResultClick}
            />

            {!hasSearched && (
              <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
                <p className="text-xl font-semibold text-gray-900 mb-2">
                  🔍 Start searching
                </p>
                <p className="text-gray-600 mb-6">
                  Enter a query above to search through 1,000+ AI/ML feeds
                </p>
                <div className="space-y-3 text-sm text-gray-700 text-left inline-block">
                  <p><strong>💡 Search Tips:</strong></p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Use <strong>full-text</strong> for exact keyword matching</li>
                    <li>Use <strong>semantic</strong> for conceptual similarity</li>
                    <li>Filter by topics, source type, and verification status</li>
                    <li>Save searches for one-click replay</li>
                    <li>Try: "machine learning", "transformers", "pytorch"</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


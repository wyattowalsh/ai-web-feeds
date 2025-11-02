/**
 * Search Results Page
 * 
 * Displays search results with highlighting, filtering, and performance metrics.
 * Integrates with search worker for sub-50ms query execution.
 * 
 * @see specs/004-client-side-features/tasks.md#t023
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { searchIndexManager, type SearchResult } from '@/lib/search/index-manager';
import { AdvancedSearchPanel, type SearchFilters } from '@/components/search/advanced-search-panel';

export default function SearchPage(): JSX.Element {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [latency, setLatency] = useState<number>(0);
  const [isSearching, setIsSearching] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    sortBy: 'relevance',
  });

  // Initialize search index
  useEffect(() => {
    searchIndexManager.initialize().then(() => {
      searchIndexManager.rebuildIfStale();
    });

    return () => {
      searchIndexManager.terminate();
    };
  }, []);

  // Execute search with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query.trim()) {
        performSearch();
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, filters]);

  const performSearch = async () => {
    setIsSearching(true);

    try {
      const { results: searchResults, latencyMs } = await searchIndexManager.search({
        query:   query.trim(),
        topics:  filters.topics,
        feedIds: filters.feedIds,
        starred: filters.starred,
        limit:   50,
      });

      // Apply sorting
      const sorted = sortResults(searchResults, filters.sortBy);

      setResults(sorted);
      setLatency(latencyMs);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const sortResults = (results: SearchResult[], sortBy: SearchFilters['sortBy']): SearchResult[] => {
    switch (sortBy) {
      case 'date':
        // Would need article dates - for now just return as-is
        return results;
      case 'readTime':
        // Would need reading time estimates - for now just return as-is
        return results;
      case 'relevance':
      default:
        return results; // Already sorted by relevance from worker
    }
  };

  const handleClearFilters = () => {
    setFilters({ sortBy: 'relevance' });
  };

  const highlightText = (text: string, query: string): JSX.Element => {
    if (!query.trim()) {
      return <>{text}</>;
    }

    const terms  = query.toLowerCase().split(/\s+/);
    const regex  = new RegExp(`(${terms.join('|')})`, 'gi');
    const parts  = text.split(regex);

    return (
      <>
        {parts.map((part, i) => 
          regex.test(part) ? (
            <mark key={i} className="bg-yellow-200" data-testid="search-highlight">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    );
  };

  return (
    <div className="container mx-auto max-w-4xl p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">Search</h1>

        {/* Search Input */}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search articles..."
          className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-testid="search-input"
          autoFocus
        />

        {/* Performance Metrics */}
        {query && (
          <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
            <span data-testid="result-count">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </span>
            {latency > 0 && (
              <span>
                in {latency.toFixed(2)}ms
                {latency < 50 && <span className="ml-2 text-green-600">✓ Fast</span>}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Advanced Filters */}
      <AdvancedSearchPanel
        filters={filters}
        onChange={setFilters}
        onClear={handleClearFilters}
        isOpen={filtersOpen}
        onToggle={() => setFiltersOpen(!filtersOpen)}
      />

      {/* Search Results */}
      <div data-testid="search-results">
        {isSearching ? (
          <div className="text-center py-12">
            <div className="text-2xl mb-2">⏳</div>
            <p>Searching...</p>
          </div>
        ) : results.length === 0 && query ? (
          <div className="text-center py-12" data-testid="empty-results">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              No Results Found
            </h2>
            <p className="text-gray-500">
              Try different keywords or adjust your filters
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {results.map((result) => (
              <SearchResultCard
                key={result.articleId}
                result={result}
                query={query}
                highlightText={highlightText}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Search Result Card Component
 */
interface SearchResultCardProps {
  result:        SearchResult;
  query:         string;
  highlightText: (text: string, query: string) => JSX.Element;
}

function SearchResultCard({ result, query, highlightText }: SearchResultCardProps): JSX.Element {
  return (
    <div
      className="rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors"
      data-testid="search-result-item"
    >
      {/* Title with Highlighting */}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {highlightText(result.title, query)}
      </h3>

      {/* Snippet with Highlighting */}
      <p className="text-sm text-gray-600 mb-3" data-testid="result-snippet">
        {highlightText(result.snippet, query)}
      </p>

      {/* Metadata */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        {/* Relevance Score */}
        <div className="flex items-center gap-1" data-testid="relevance-score">
          <span>⭐</span>
          <span>{(result.relevance * 100).toFixed(0)}%</span>
        </div>

        {/* Match Count */}
        <div>
          {result.positions.length} match{result.positions.length !== 1 ? 'es' : ''}
        </div>

        {/* View Button */}
        <a
          href={`/articles/${result.articleId}`}
          className="ml-auto text-blue-600 hover:underline"
        >
          View Article →
        </a>
      </div>
    </div>
  );
}

"use client";

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

export function SearchResults({
  results,
  searchType,
  loading,
  onResultClick,
}: {
  results: SearchResult[];
  searchType: "full_text" | "semantic";
  loading: boolean;
  onResultClick?: (feedId: string) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-gray-200 rounded-lg h-32 animate-pulse" />
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
        <p className="text-lg font-semibold text-yellow-900 mb-2">No results found</p>
        <p className="text-sm text-yellow-800">Try adjusting your search query or filters</p>
        <div className="mt-4 space-y-2 text-sm text-yellow-700">
          <p>
            💡 <strong>Tips:</strong>
          </p>
          <ul className="text-left inline-block">
            <li>• Use fewer filters</li>
            <li>• Try different keywords</li>
            <li>• Switch between full-text and semantic search</li>
            <li>• Lower the similarity threshold for semantic search</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600">
          Found <strong>{results.length}</strong> result{results.length !== 1 ? "s" : ""}
          {searchType === "semantic" && " (sorted by similarity)"}
        </p>
      </div>

      {results.map((result, idx) => (
        <div
          key={result.id}
          className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-gray-500">#{idx + 1}</span>
                <h3 className="text-xl font-bold text-gray-900">{result.title}</h3>
                {result.verified && (
                  <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full font-medium">
                    ✓ Verified
                  </span>
                )}
                {!result.is_active && (
                  <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                    Inactive
                  </span>
                )}
                {searchType === "semantic" && result.similarity !== undefined && (
                  <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full font-mono">
                    {(result.similarity * 100).toFixed(1)}%
                  </span>
                )}
              </div>

              {result.description && (
                <p className="text-gray-600 text-sm mb-3">{result.description}</p>
              )}

              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                  {result.source_type}
                </span>
                {result.topics.map((topic) => (
                  <span
                    key={topic}
                    className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded font-medium"
                  >
                    {topic.toUpperCase()}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-4 text-sm">
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onResultClick?.(result.id)}
                  className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                >
                  🔗 {result.url}
                </a>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

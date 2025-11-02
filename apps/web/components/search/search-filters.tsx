"use client";

interface SearchFiltersProps {
  searchType: "full_text" | "semantic";
  onSearchTypeChange: (type: "full_text" | "semantic") => void;
  sourceType?: string;
  onSourceTypeChange: (type: string | undefined) => void;
  topics: string[];
  onTopicsChange: (topics: string[]) => void;
  verified?: boolean;
  onVerifiedChange: (verified: boolean | undefined) => void;
  threshold: number;
  onThresholdChange: (threshold: number) => void;
}

export function SearchFilters({
  searchType,
  onSearchTypeChange,
  sourceType,
  onSourceTypeChange,
  topics,
  onTopicsChange,
  verified,
  onVerifiedChange,
  threshold,
  onThresholdChange,
}: SearchFiltersProps) {
  const sourceTypes = [
    { value: "", label: "All Sources" },
    { value: "blog", label: "Blog" },
    { value: "newsletter", label: "Newsletter" },
    { value: "podcast", label: "Podcast" },
    { value: "video", label: "Video" },
    { value: "journal", label: "Journal" },
    { value: "preprint", label: "Preprint" },
  ];

  const commonTopics = [
    "llm",
    "agents",
    "training",
    "inference",
    "genai",
    "ml",
    "cv",
    "nlp",
    "rl",
    "data",
    "safety",
  ];

  const handleTopicToggle = (topic: string) => {
    if (topics.includes(topic)) {
      onTopicsChange(topics.filter((t) => t !== topic));
    } else {
      onTopicsChange([...topics, topic]);
    }
  };

  return (
    <div className="bg-white rounded-lg border p-6 space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Search Type</h3>
        <div className="flex gap-2">
          <button
            onClick={() => onSearchTypeChange("full_text")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              searchType === "full_text"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Full-Text
          </button>
          <button
            onClick={() => onSearchTypeChange("semantic")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              searchType === "semantic"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Semantic
          </button>
        </div>
        {searchType === "semantic" && (
          <div className="mt-3">
            <label className="block text-xs text-gray-600 mb-1">
              Similarity Threshold: {threshold.toFixed(2)}
            </label>
            <input
              type="range"
              min="0.5"
              max="1.0"
              step="0.05"
              value={threshold}
              onChange={(e) => onThresholdChange(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Less strict</span>
              <span>More strict</span>
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-3">Source Type</label>
        <select
          value={sourceType || ""}
          onChange={(e) => onSourceTypeChange(e.target.value || undefined)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {sourceTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-3">Topics</label>
        <div className="flex flex-wrap gap-2">
          {commonTopics.map((topic) => (
            <button
              key={topic}
              onClick={() => handleTopicToggle(topic)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                topics.includes(topic)
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {topic.toUpperCase()}
            </button>
          ))}
        </div>
        {topics.length > 0 && (
          <button
            onClick={() => onTopicsChange([])}
            className="mt-2 text-xs text-blue-600 hover:text-blue-800"
          >
            Clear all topics
          </button>
        )}
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Verification Status
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => onVerifiedChange(undefined)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              verified === undefined
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          <button
            onClick={() => onVerifiedChange(true)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              verified === true
                ? "bg-green-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            ✓ Verified
          </button>
          <button
            onClick={() => onVerifiedChange(false)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              verified === false
                ? "bg-gray-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Unverified
          </button>
        </div>
      </div>
    </div>
  );
}

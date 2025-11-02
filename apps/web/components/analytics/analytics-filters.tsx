"use client";

interface AnalyticsFiltersProps {
  dateRange: string;
  onDateRangeChange: (range: string) => void;
  topic?: string;
  onTopicChange: (topic: string | undefined) => void;
  onRefresh: () => void;
  onExport: () => void;
}

export function AnalyticsFilters({
  dateRange,
  onDateRangeChange,
  topic,
  onTopicChange,
  onRefresh,
  onExport,
}: AnalyticsFiltersProps) {
  const dateRanges = [
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
    { value: "90d", label: "Last 90 days" },
  ];

  return (
    <div className="bg-white rounded-lg border p-4 flex flex-wrap items-center gap-4">
      <div className="flex-1 min-w-[200px]">
        <label className="block text-sm font-medium text-gray-700 mb-1">Time Range</label>
        <select
          value={dateRange}
          onChange={(e) => onDateRangeChange(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {dateRanges.map((range) => (
            <option key={range.value} value={range.value}>
              {range.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 min-w-[200px]">
        <label className="block text-sm font-medium text-gray-700 mb-1">Topic Filter</label>
        <input
          type="text"
          value={topic || ""}
          onChange={(e) => onTopicChange(e.target.value || undefined)}
          placeholder="e.g., llm, agents, training"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex gap-2 items-end">
        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          🔄 Refresh
        </button>
        <button
          onClick={onExport}
          className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
        >
          📥 Export CSV
        </button>
      </div>
    </div>
  );
}

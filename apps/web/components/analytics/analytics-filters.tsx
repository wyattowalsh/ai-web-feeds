"use client";

import { Download, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

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
    <div className="surface-card grid gap-4 md:grid-cols-[1fr_1fr_6rem] lg:grid-cols-[1fr_1fr_auto] md:items-end lg:items-end">
      <div>
        <label htmlFor="analytics-range" className="field-label">
          Time range
        </label>
        <Select
          id="analytics-range"
          value={dateRange}
          onChange={(e) => onDateRangeChange(e.target.value)}
        >
          {dateRanges.map((range) => (
            <option key={range.value} value={range.value}>
              {range.label}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label htmlFor="analytics-topic" className="field-label">
          Topic focus
        </label>
        <Input
          id="analytics-topic"
          type="text"
          value={topic || ""}
          onChange={(e) => onTopicChange(e.target.value || undefined)}
          placeholder="e.g., llm, agents, training"
        />
      </div>

      <div className="flex flex-wrap gap-2 md:justify-end">
        <Button onClick={onRefresh} variant="outline">
          <RefreshCcw className="size-4" />
          Refresh
        </Button>
        <Button onClick={onExport} variant="default">
          <Download className="size-4" />
          Export CSV
        </Button>
      </div>
    </div>
  );
}

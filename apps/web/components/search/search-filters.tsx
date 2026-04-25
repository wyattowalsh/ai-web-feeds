"use client";

import { Newspaper, RadioTower, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import type { SearchScope } from "@/lib/search";

interface SearchFiltersProps {
  scope: "sources" | "articles";
  onScopeChange: (scope: "sources" | "articles") => void;
  showScopeToggle?: boolean;
  sourceType?: string;
  onSourceTypeChange: (type: string | undefined) => void;
  topics: string[];
  onTopicsChange: (topics: string[]) => void;
  verified?: boolean;
  onVerifiedChange: (verified: boolean | undefined) => void;
}

const SOURCE_TYPES = [
  { value: "", label: "All source types" },
  { value: "blog", label: "Blog" },
  { value: "newsletter", label: "Newsletter" },
  { value: "podcast", label: "Podcast" },
  { value: "video", label: "Video" },
  { value: "github", label: "GitHub" },
  { value: "arxiv", label: "ArXiv" },
  { value: "reddit", label: "Reddit" },
  { value: "youtube", label: "YouTube" },
];

const COMMON_TOPICS = [
  "llm",
  "agents",
  "research",
  "mlops",
  "retrieval",
  "inference",
  "evaluation",
  "open-source",
  "safety",
  "governance",
];

export function SearchFilters({
  scope,
  onScopeChange,
  showScopeToggle = true,
  sourceType,
  onSourceTypeChange,
  topics,
  onTopicsChange,
  verified,
  onVerifiedChange,
}: SearchFiltersProps) {
  const handleTopicToggle = (topic: string) => {
    if (topics.includes(topic)) {
      onTopicsChange(topics.filter((value) => value !== topic));
      return;
    }

    onTopicsChange([...topics, topic]);
  };

  return (
    <div className="surface-card space-y-6">
      <div>
        <div className="mb-4 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand-strong)">
            <SlidersHorizontal className="size-4" />
          </span>
          <div>
            <p className="metric-label">Filters</p>
            <h3 className="text-lg font-semibold text-(--ink)">Choose what to search</h3>
          </div>
        </div>
        {showScopeToggle ? (
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => onScopeChange("sources")}
              variant={scope === "sources" ? "default" : "secondary"}
            >
              Sources
            </Button>
            <Button
              type="button"
              onClick={() => onScopeChange("articles")}
              variant={scope === "articles" ? "default" : "secondary"}
            >
              Articles
            </Button>
          </div>
        ) : (
          <p className="small-note">
            Filters apply to the recent-article search inside the unified feeds workspace.
          </p>
        )}
      </div>

      <div>
        <label className="field-label">Source type</label>
        <Select
          value={sourceType || ""}
          onChange={(event) => onSourceTypeChange(event.target.value || undefined)}
        >
          {SOURCE_TYPES.map((source) => (
            <option key={source.value} value={source.value}>
              {source.label}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="field-label">Topics</label>
        <div className="flex flex-wrap gap-2">
          {COMMON_TOPICS.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => handleTopicToggle(topic)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition duration-150",
                topics.includes(topic)
                  ? "border-(--brand) bg-(--brand) text-(--fd-primary-foreground)"
                  : "border-(--line) bg-(--surface) text-(--ink-muted) hover:bg-(--surface-muted)",
              )}
            >
              {topic.toUpperCase()}
            </button>
          ))}
        </div>
        {topics.length > 0 && (
          <button
            type="button"
            onClick={() => onTopicsChange([])}
            className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-(--brand-strong)"
          >
            Clear topics
          </button>
        )}
      </div>

      <div>
        <label className="field-label">Verification</label>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => onVerifiedChange(undefined)}
            variant={verified === undefined ? "default" : "secondary"}
          >
            All
          </Button>
          <Button
            type="button"
            onClick={() => onVerifiedChange(true)}
            variant={verified === true ? "default" : "secondary"}
          >
            Verified
          </Button>
          <Button
            type="button"
            onClick={() => onVerifiedChange(false)}
            variant={verified === false ? "default" : "secondary"}
          >
            Unverified
          </Button>
        </div>
      </div>
    </div>
  );
}

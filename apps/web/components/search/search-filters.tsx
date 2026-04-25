"use client";

import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";

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
    <div className="surface-card space-y-6">
      <div>
        <div className="mb-4 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand-strong)">
            <SlidersHorizontal className="size-4" />
          </span>
          <div>
            <p className="metric-label">Filters</p>
            <h3 className="text-lg font-semibold text-(--ink)">Tune the search strategy</h3>
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
        <label className="field-label">Source Type</label>
        <Select
          value={sourceType || ""}
          onChange={(e) => onSourceTypeChange(e.target.value || undefined)}
        >
          {sourceTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="field-label">Topics</label>
        <div className="flex flex-wrap gap-2">
          {commonTopics.map((topic) => (
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
            Clear all topics
          </button>
        )}
      </div>

      <div>
        <label className="field-label">Verification Status</label>
        <div className="flex gap-2">
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
            ✓ Verified
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

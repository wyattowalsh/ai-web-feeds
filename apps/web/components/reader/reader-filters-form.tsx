"use client";

import type { RefObject } from "react";

import { LayoutGrid, List, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import {
  toggleTopic,
  type ArticleSort,
  type ReaderDraftState,
  type ReaderView,
  type VerifiedDraftValue,
} from "@/lib/reader";

export type ReaderFiltersFormProps = {
  /** Current draft filter state (unapplied) */
  draftState: ReaderDraftState;
  setQuery: (value: string) => void;
  setSourceType: (value: string) => void;
  setTopics: (value: string[]) => void;
  setVerified: (value: VerifiedDraftValue) => void;
  setReaderView: (value: ReaderView) => void;
  setSort: (value: ArticleSort) => void;
  /** Submit the current drafts to update URL/filters */
  applyDrafts: () => void;
  /** Reset all drafts and clear filters in URL */
  resetDrafts: () => void;
  /** Precomputed topic counts for quick chips (top ~12) */
  topicCounts: Array<{ topic: string; count: number }>;
  /** Controls whether verification filter UI is shown */
  hasVerificationMetadata: boolean;
  /** Current reader layout preference for the toggle buttons */
  layout: "cards" | "list" | "compact";
  /** Callback to persist layout preference change */
  onLayoutChange: (layout: "cards" | "list" | "compact") => void;
  /** Variant determines id/aria/label suffixes, structure for topic/verif grouping, and apply button chrome */
  variant: "desktop" | "mobile";
  /** Available source_type options for the select */
  sourceTypes: string[];
  /** Topic options not yet selected (for the "add" select) */
  availableTopicOptions: string[];
  /** Optional ref forwarded to the search input (desktop sidebar only) */
  queryInputRef?: RefObject<HTMLInputElement | null>;
  /** Whether apply should be enabled (has unapplied draft changes) */
  hasPendingDraftChanges: boolean;
};

/**
 * ReaderFiltersForm
 *
 * Shared controlled form JSX for the desktop sidebar filters (xl+) and
 * the mobile/collapsed details filters. Renders nearly identical controls
 * with variant-specific ids, aria labels, and minor structural tweaks
 * (e.g. topic note text, count display in quick chips, grouping of verif+view).
 *
 * State + handlers are lifted; this component is presentational + interactive.
 * Extracted to remove ~180 LOC of duplicated filter blocks from feeds-workspace-client.
 */
export function ReaderFiltersForm({
  draftState,
  setQuery,
  setSourceType,
  setTopics,
  setVerified,
  setReaderView,
  setSort,
  applyDrafts,
  resetDrafts,
  topicCounts,
  hasVerificationMetadata,
  layout,
  onLayoutChange,
  variant,
  sourceTypes,
  availableTopicOptions,
  queryInputRef,
  hasPendingDraftChanges,
}: ReaderFiltersFormProps) {
  const isDesktop = variant === "desktop";
  const isMobile = variant === "mobile";

  const qId = isDesktop ? "reader-search" : "reader-search-mobile";
  const qAria = isDesktop ? "Search posts" : "Search posts mobile";

  const stId = isDesktop ? "reader-source-type" : "reader-source-type-mobile";
  const stAria = isDesktop ? "Source type" : "Source type mobile";

  const topicSelId = isDesktop ? "reader-topic-focus" : "reader-topic-focus-mobile";
  const topicSelAria = isDesktop ? "Add topic focus" : "Add topic focus mobile";

  const verifId = isDesktop ? "reader-verification" : "reader-verification-mobile";
  const verifAria = isDesktop ? "Verification" : "Verification mobile";

  const viewId = isDesktop ? "reader-view" : "reader-view-mobile";
  const viewAria = isDesktop ? "Reader view" : "Reader view mobile";

  const sortId = isDesktop ? "reader-sort" : "reader-sort-mobile";
  const sortAria = isDesktop ? "Sort articles" : "Sort articles mobile";

  const handleTopicSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const topic = event.target.value;
    if (topic) {
      setTopics(toggleTopic(draftState.topics, topic));
    }
  };

  const handleChipRemove = (topic: string) => {
    setTopics(toggleTopic(draftState.topics, topic));
  };

  const handleQuickTopic = (topic: string) => {
    setTopics(toggleTopic(draftState.topics, topic));
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    applyDrafts();
  };

  return (
    <form className="mt-4 space-y-4" onSubmit={onSubmit}>
      <label className="space-y-1.5 text-sm">
        <span className="small-note">Search posts</span>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-(--ink-muted)" />
          <Input
            ref={isDesktop ? queryInputRef : undefined}
            id={qId}
            name="q"
            aria-label={qAria}
            placeholder="Search titles, summaries, authors"
            value={draftState.query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-10"
          />
        </div>
      </label>

      <label className="space-y-1.5 text-sm">
        <span className="small-note">Source type</span>
        <Select
          id={stId}
          name="source_type"
          aria-label={stAria}
          value={draftState.sourceType}
          onChange={(event) => setSourceType(event.target.value)}
        >
          <option value="">All source types</option>
          {sourceTypes.map((sourceType) => (
            <option key={sourceType} value={sourceType}>
              {sourceType}
            </option>
          ))}
        </Select>
      </label>

      <div className={isDesktop ? "space-y-3" : "space-y-2"}>
        <div className="space-y-1.5 text-sm">
          <span className="small-note">Topic focus</span>
          <Select
            id={topicSelId}
            name="topic"
            aria-label={topicSelAria}
            value=""
            onChange={handleTopicSelect}
          >
            <option value="">
              {draftState.topics.length > 0 ? "Add another topic" : "All topics"}
            </option>
            {availableTopicOptions.map((topic) => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
          </Select>
          {draftState.topics.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {draftState.topics.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => handleChipRemove(topic)}
                  className="inline-flex items-center gap-2 rounded-full border border-(--brand) bg-(--brand-soft) px-3 py-1 text-xs font-semibold text-(--brand-strong)"
                >
                  {topic}
                  <X className="size-3.5" />
                </button>
              ))}
            </div>
          ) : isDesktop ? (
            <p className="small-note">Choose one or more topic slices.</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {topicCounts.map(({ topic, count }) => (
            <button
              key={topic}
              type="button"
              aria-pressed={draftState.topics.includes(topic)}
              onClick={() => handleQuickTopic(topic)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition duration-150",
                draftState.topics.includes(topic)
                  ? "border-(--brand) bg-(--brand-soft) text-(--brand-strong)"
                  : "border-(--line) bg-(--surface) text-(--ink-muted) hover:bg-(--surface-muted)",
              )}
            >
              {topic}
              {isDesktop ? (
                <span className="ml-2 text-[0.68rem] uppercase tracking-[0.12em] opacity-70">
                  {count}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {isDesktop ? (
        <>
          {hasVerificationMetadata ? (
            <label className="space-y-1.5 text-sm">
              <span className="small-note">Verification</span>
              <Select
                id={verifId}
                name="verified"
                aria-label={verifAria}
                value={draftState.verified}
                onChange={(event) => setVerified(event.target.value as VerifiedDraftValue)}
              >
                <option value="">All feeds</option>
                <option value="true">Verified only</option>
                <option value="false">Unverified only</option>
              </Select>
            </label>
          ) : null}

          <label className="space-y-1.5 text-sm">
            <span className="small-note">Reader view</span>
            <Select
              id={viewId}
              name="view"
              aria-label={viewAria}
              value={draftState.readerView}
              onChange={(event) => setReaderView(event.target.value as ReaderView)}
            >
              <option value="latest">Latest</option>
              <option value="unread">Unread</option>
              <option value="saved">Saved</option>
              <option value="starred">Starred</option>
              <option value="archived">Archived</option>
            </Select>
          </label>

          <label className="space-y-1.5 text-sm">
            <span className="small-note">Sort</span>
            <Select
              id={sortId}
              name="sort"
              aria-label={sortAria}
              value={draftState.sort}
              onChange={(event) => setSort(event.target.value as ArticleSort)}
            >
              <option value="latest">Latest first</option>
              <option value="oldest">Oldest first</option>
              <option value="source">By source</option>
            </Select>
          </label>
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {hasVerificationMetadata ? (
              <label className="space-y-1.5 text-sm">
                <span className="small-note">Verification</span>
                <Select
                  id={verifId}
                  name="verified"
                  aria-label={verifAria}
                  value={draftState.verified}
                  onChange={(event) => setVerified(event.target.value as VerifiedDraftValue)}
                >
                  <option value="">All feeds</option>
                  <option value="true">Verified only</option>
                  <option value="false">Unverified only</option>
                </Select>
              </label>
            ) : null}
            <label className="space-y-1.5 text-sm">
              <span className="small-note">View</span>
              <Select
                id={viewId}
                name="view"
                aria-label={viewAria}
                value={draftState.readerView}
                onChange={(event) => setReaderView(event.target.value as ReaderView)}
              >
                <option value="latest">Latest</option>
                <option value="unread">Unread</option>
                <option value="saved">Saved</option>
                <option value="starred">Starred</option>
                <option value="archived">Archived</option>
              </Select>
            </label>
          </div>
          <label className="space-y-1.5 text-sm">
            <span className="small-note">Sort</span>
            <Select
              id={sortId}
              name="sort"
              aria-label={sortAria}
              value={draftState.sort}
              onChange={(event) => setSort(event.target.value as ArticleSort)}
            >
              <option value="latest">Latest first</option>
              <option value="oldest">Oldest first</option>
              <option value="source">By source</option>
            </Select>
          </label>
        </>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant={layout === "cards" ? "default" : "outline"}
          className="flex-1"
          onClick={() => onLayoutChange("cards")}
        >
          <LayoutGrid className="size-4" />
          Cards
        </Button>
        <Button
          type="button"
          variant={layout === "list" ? "default" : "outline"}
          className="flex-1"
          onClick={() => onLayoutChange("list")}
        >
          <List className="size-4" />
          List
        </Button>
      </div>

      <div
        className={cn(
          "flex flex-wrap gap-2",
          isDesktop && "border-t border-(--line) pt-4",
        )}
      >
        <Button type="submit" className="flex-1" disabled={!hasPendingDraftChanges}>
          Apply filters
        </Button>
        <Button type="button" variant="outline" onClick={resetDrafts}>
          Reset
        </Button>
      </div>
    </form>
  );
}

export default ReaderFiltersForm;

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import type { FeedsWorkspaceInitialState } from "@/lib/reader-route-types";
import type { FeedStats } from "@/lib/reader";

import { useReaderFilterDraft } from "./use-reader-filter-draft";

const feeds = [
  {
    id: "feed-1",
    title: "Agents",
    topics: ["agents"],
    tags: ["ml"],
    source_type: "blog",
    verified: true,
    is_active: true,
  },
  {
    id: "feed-2",
    title: "News",
    topics: ["news"],
    tags: [],
    source_type: "newsletter",
    verified: false,
    is_active: true,
  },
] as const;

const currentState: FeedsWorkspaceInitialState = {
  query: "",
  sourceType: null,
  topics: [],
  verified: null,
  feedIds: [],
  sort: "latest",
  readerView: "latest",
  cursor: 0,
};

const stats: FeedStats = {
  total: 2,
  verified: 1,
  active: 2,
  hasVerificationMetadata: true,
  hasActivityMetadata: true,
  sourceTypeCount: 2,
  byType: {},
  topicCount: 2,
};

describe("useReaderFilterDraft", () => {
  let updateUrl: ReturnType<typeof vi.fn>;
  let onBeforeNavigate: ReturnType<typeof vi.fn>;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    updateUrl = vi.fn();
    onBeforeNavigate = vi.fn();
  });

  function renderDraft(
    overrides: Partial<Parameters<typeof useReaderFilterDraft>[0]> = {},
    state = currentState,
  ) {
    return renderHook(
      ({ appliedState }) =>
        useReaderFilterDraft({
          currentState: appliedState,
          feeds: [...feeds],
          stats,
          updateUrl,
          layout: "list",
          onLayoutChange: vi.fn(),
          queryInputRef: { current: null },
          onBeforeNavigate,
          ...overrides,
        }),
      { initialProps: { appliedState: state } },
    );
  }

  it("syncs draft fields when currentState changes", () => {
    const { result, rerender } = renderDraft();

    rerender({
      appliedState: {
        ...currentState,
        query: "agents",
        readerView: "saved",
        topics: ["agents"],
      },
    });

    expect(result.current.filterFormProps.draftState.query).toBe("agents");
    expect(result.current.filterFormProps.draftState.readerView).toBe("saved");
    expect(result.current.filterFormProps.draftState.topics).toEqual(["agents"]);
  });

  it("applyDrafts pushes normalized URL overrides and runs side effects", () => {
    const { result } = renderDraft();

    act(() => {
      result.current.filterFormProps.setQuery("  multi   word ");
      result.current.filterFormProps.setReaderView("saved");
      result.current.filterFormProps.setTopics(["agents"]);
    });

    act(() => {
      result.current.applyDrafts();
    });

    expect(onBeforeNavigate).toHaveBeenCalledTimes(1);
    expect(result.current.mobileRail.open).toBe(false);
    expect(updateUrl).toHaveBeenCalledWith({
      q: "multi word",
      source_type: null,
      topics: "agents",
      verified: null,
      reader_view: "saved",
      sort: null,
      cursor: null,
    });
  });

  it("resetDrafts clears drafts and URL filters", () => {
    const { result } = renderDraft(
      {},
      {
        ...currentState,
        query: "agents",
        sourceType: "blog",
        topics: ["agents"],
        verified: true,
        readerView: "starred",
        sort: "oldest",
      },
    );

    act(() => {
      result.current.resetDrafts();
    });

    expect(result.current.filterFormProps.draftState).toMatchObject({
      query: "",
      sourceType: "",
      topics: [],
      verified: "",
      readerView: "latest",
      sort: "latest",
    });
    expect(updateUrl).toHaveBeenCalledWith({
      q: null,
      source_type: null,
      topics: null,
      verified: null,
      reader_view: null,
      sort: null,
      cursor: null,
    });
  });

  it("closes mobile rail after applyDrafts", () => {
    const { result } = renderDraft();

    act(() => {
      result.current.mobileRail.onOpenChange(true);
    });
    expect(result.current.mobileRail.open).toBe(true);

    act(() => {
      result.current.applyDrafts();
    });

    expect(result.current.mobileRail.open).toBe(false);
  });

  it("exposes pending-change detection and topic metadata", () => {
    const { result } = renderDraft();

    expect(result.current.filterFormProps.hasPendingDraftChanges).toBe(false);
    expect(result.current.filterFormProps.sourceTypes).toContain("blog");
    expect(result.current.filterFormProps.topicCounts.length).toBeGreaterThan(0);

    act(() => {
      result.current.filterFormProps.setQuery("agents");
    });

    expect(result.current.filterFormProps.hasPendingDraftChanges).toBe(true);
  });
});

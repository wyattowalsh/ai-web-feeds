import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import type { FeedsWorkspaceInitialState } from "@/lib/reader-route-types";
import type { FeedStats } from "@/lib/reader";

import { useReaderRouteState } from "./use-reader-route-state";

const { replaceMock, useSearchParamsMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  useSearchParamsMock: vi.fn(() => new URLSearchParams()),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => useSearchParamsMock(),
}));

const initialState: FeedsWorkspaceInitialState = {
  query: "agents",
  sourceType: "blog",
  topics: ["agents"],
  verified: true,
  feedIds: ["feed-1"],
  sort: "latest",
  readerView: "latest",
  cursor: 0,
};

const stats: FeedStats = {
  total: 1,
  verified: 1,
  active: 1,
  hasVerificationMetadata: true,
  hasActivityMetadata: true,
  sourceTypeCount: 1,
  byType: {},
  topicCount: 1,
};

describe("useReaderRouteState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSearchParamsMock.mockReturnValue(new URLSearchParams("q=agents&source_type=blog"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses current state from search params and preserves verification when metadata exists", () => {
    useSearchParamsMock.mockReturnValue(
      new URLSearchParams("q=agents&source_type=blog&verified=true"),
    );

    const { result } = renderHook(() => useReaderRouteState({ initialState, stats }));

    expect(result.current.currentState.query).toBe("agents");
    expect(result.current.currentState.sourceType).toBe("blog");
    expect(result.current.currentState.verified).toBe(true);
    expect(result.current.searchParamsString).toBe("q=agents&source_type=blog&verified=true");
  });

  it("nulls verified when verification metadata is unavailable", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("verified=true"));

    const { result } = renderHook(() =>
      useReaderRouteState({
        initialState,
        stats: { ...stats, hasVerificationMetadata: false },
      }),
    );

    expect(result.current.currentState.verified).toBeNull();
  });

  it("builds initial href and replaces URL on updateUrl", () => {
    const { result } = renderHook(() => useReaderRouteState({ initialState, stats }));

    expect(result.current.initialParamsString).toContain("q=agents");
    result.current.updateUrl({ q: "ml", cursor: null });

    expect(replaceMock).toHaveBeenCalledWith(expect.stringContaining("q=ml"), { scroll: false });
  });
});

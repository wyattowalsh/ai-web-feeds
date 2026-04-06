import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedSource } from "@/lib/feeds-filters";

const { replaceMock, useSearchParamsMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  useSearchParamsMock: vi.fn(() => new URLSearchParams()),
}));

let currentSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => "/feeds",
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => useSearchParamsMock(),
}));

import { FeedCatalog } from "./feed-catalog";

const feeds: FeedSource[] = [
  {
    id: "feed-1",
    title: "Agent Feed",
    description: "Agent systems coverage",
    url: "https://example.com/feed-1.xml",
    website_url: "https://example.com/feed-1",
    source_type: "blog",
    topics: ["agents"],
    verified: true,
    is_active: true,
  },
  {
    id: "feed-2",
    title: "ML Digest",
    description: "Machine learning notes",
    url: "https://example.com/feed-2.xml",
    website_url: "https://example.com/feed-2",
    source_type: "newsletter",
    topics: ["ml"],
    verified: false,
    is_active: true,
  },
];

describe("FeedCatalog", () => {
  beforeEach(() => {
    currentSearchParams = new URLSearchParams();
    useSearchParamsMock.mockImplementation(() => currentSearchParams);

    replaceMock.mockReset();
    replaceMock.mockImplementation((url: string) => {
      const parsed = new URL(url, "https://aiwebfeeds.test");
      currentSearchParams = new URLSearchParams(parsed.search);
      useSearchParamsMock.mockImplementation(() => currentSearchParams);
    });
  });

  it("renders visible counts, active filter summary, and repeated-feed OPML export for the current view", () => {
    currentSearchParams = new URLSearchParams("q=agent&source_type=blog&verified=true");
    useSearchParamsMock.mockImplementation(() => currentSearchParams);

    render(
      <FeedCatalog
        feeds={feeds}
        sourceTypes={["blog", "newsletter"]}
        initialQuery="agent"
        initialSourceType="blog"
        initialTopic={null}
        initialVerified={true}
      />,
    );

    expect(
      screen.getByText((_, element) => element?.textContent === "Showing 1 of 2 feeds"),
    ).toBeInTheDocument();
    expect(screen.getByText('Query "agent" · Type blog · Verified only')).toBeInTheDocument();

    const visibleExport = screen.getByRole("link", { name: "Export visible OPML" });
    expect(visibleExport).toHaveAttribute("href", "/api/exports/opml?format=filtered&feed=feed-1");

    expect(screen.getByRole("link", { name: "Open in reader" })).toHaveAttribute(
      "href",
      "/reader?feed=feed-1",
    );
    expect(screen.getByRole("link", { name: "Export OPML" })).toHaveAttribute(
      "href",
      "/api/exports/opml?format=filtered&feed=feed-1",
    );
  });

  it("keeps q/source_type/topic/verified in URL state as filters change", () => {
    render(
      <FeedCatalog
        feeds={feeds}
        sourceTypes={["blog", "newsletter"]}
        initialQuery=""
        initialSourceType={null}
        initialTopic={null}
        initialVerified={null}
      />,
    );

    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "agents" },
    });
    expect(replaceMock).toHaveBeenLastCalledWith("/feeds?q=agents", { scroll: false });

    fireEvent.click(screen.getByRole("button", { name: "blog (1)" }));
    expect(replaceMock).toHaveBeenLastCalledWith("/feeds?q=agents&source_type=blog", { scroll: false });

    fireEvent.click(screen.getByRole("button", { name: "agents" }));
    expect(replaceMock).toHaveBeenLastCalledWith(
      "/feeds?q=agents&source_type=blog&topic=agents",
      { scroll: false },
    );

    fireEvent.click(screen.getByRole("button", { name: "Verified" }));
    expect(replaceMock).toHaveBeenLastCalledWith(
      "/feeds?q=agents&source_type=blog&topic=agents&verified=true",
      { scroll: false },
    );
  });
});

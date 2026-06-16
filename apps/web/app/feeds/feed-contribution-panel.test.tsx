import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedSource } from "@/lib/feeds-filters";

import { FeedContributionPanel } from "./feed-contribution-panel";

const storage = new Map<string, string>();
const writeTextMock = vi.fn(async () => undefined);

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
];

function renderPanel() {
  return render(<FeedContributionPanel feeds={feeds} topics={["agents", "llm"]} />);
}

function fillRequiredFields(url = "https://new.example.com/feed.xml") {
  fireEvent.change(screen.getByLabelText("Feed URL"), {
    target: { value: url },
  });
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "New Research Feed" },
  });
  fireEvent.change(screen.getByLabelText("Topics"), {
    target: { value: "Agents, Large Language Models" },
  });
  fireEvent.change(screen.getByLabelText("Notes"), {
    target: { value: "Useful applied research notes" },
  });
}

describe("FeedContributionPanel", () => {
  beforeEach(() => {
    storage.clear();
    writeTextMock.mockClear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => storage.clear(),
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    });
  });

  it("queues a valid feed contribution as YAML-ready local state", async () => {
    renderPanel();

    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Add feed" }));

    expect(await screen.findByText("Queued New Research Feed.")).toBeInTheDocument();
    expect(screen.getByText("1 queued")).toBeInTheDocument();
    expect(screen.getByText("Contribution queue")).toBeInTheDocument();
    expect(screen.getByText("New Research Feed")).toBeInTheDocument();

    const yamlPreview = screen.getByLabelText("Contribution YAML");
    expect(yamlPreview).toHaveValue(
      [
        '- url: "https://new.example.com/feed.xml"',
        "  topics:",
        '  - "agents"',
        '  - "large-language-models"',
        '  title: "New Research Feed"',
        '  notes: "Useful applied research notes"',
      ].join("\n"),
    );
  });

  it("blocks exact catalog duplicates before queueing", () => {
    renderPanel();

    fillRequiredFields("https://example.com/feed-1.xml");
    fireEvent.click(screen.getByRole("button", { name: "Add feed" }));

    expect(screen.getByText("Already in catalog: Agent Feed")).toBeInTheDocument();
    expect(screen.queryByText("Contribution queue")).not.toBeInTheDocument();
  });

  it("loads queued feed drafts from local storage", async () => {
    storage.set(
      "aiwebfeeds.sourceContributions.v1",
      JSON.stringify([
        {
          id: "draft-1",
          url: "https://stored.example.com/feed.xml",
          title: "Stored Feed",
          topics: ["agents"],
          notes: "Queued earlier",
          createdAt: "2026-06-15T12:00:00.000Z",
        },
      ]),
    );

    renderPanel();

    expect(await screen.findByText("Stored Feed")).toBeInTheDocument();
    expect(screen.getByText("1 queued")).toBeInTheDocument();
  });

  it("copies all queued YAML to the clipboard", async () => {
    renderPanel();

    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Add feed" }));
    await screen.findByText("Queued New Research Feed.");

    fireEvent.click(screen.getByRole("button", { name: "Copy all YAML" }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        expect.stringContaining("new.example.com/feed.xml"),
      );
    });
    // Use findBy to await the async setStatus re-render after clipboard write + state update.
    await screen.findByText("Copied queued feed YAML.");
    expect(screen.getByText("Copied queued feed YAML.")).toBeInTheDocument();
  });
});

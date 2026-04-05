import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchBar } from "./search-bar";

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
    },
    status: init?.status ?? 200,
  });
}

describe("SearchBar", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("exposes combobox/listbox semantics and supports keyboard selection", async () => {
    const onSearch = vi.fn();
    fetchMock.mockResolvedValue(
      jsonResponse({
        feeds: [
          {
            id: "feed-1",
            title: "Agent Systems Daily",
            type: "feed",
            url: "https://example.com/agents",
          },
        ],
        topics: [
          {
            label: "agents",
            type: "topic",
            feed_count: 12,
          },
        ],
      }),
    );

    render(<SearchBar onSearch={onSearch} />);

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "ag" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(screen.getByRole("listbox", { name: "Search suggestions" })).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-label", "Search feeds");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", "feed-feed-1-0");
    const selectedOption = screen.getByRole("option", { name: /Agent Systems Daily/i });
    expect(selectedOption).toHaveAttribute("aria-selected", "true");
    expect(selectedOption).toHaveAttribute("tabindex", "-1");

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSearch).toHaveBeenCalledWith("Agent Systems Daily");
  });

  it("normalizes whitespace before fetching autocomplete and submitting free-text searches", async () => {
    const onSearch = vi.fn();
    fetchMock.mockResolvedValue(jsonResponse({ feeds: [], topics: [] }));

    render(<SearchBar onSearch={onSearch} />);

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "  agent   systems  " } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/search/autocomplete?prefix=agent%20systems",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );

    fireEvent.submit(input.closest("form")!);
    expect(onSearch).toHaveBeenCalledWith("agent systems");
  });

  it("ignores stale autocomplete responses when a newer query finishes first", async () => {
    const onSearch = vi.fn();
    let resolveFirst: ((value: Response) => void) | undefined;
    let resolveSecond: ((value: Response) => void) | undefined;

    fetchMock
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveSecond = resolve;
          }),
      );

    render(<SearchBar onSearch={onSearch} />);

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "ag" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    fireEvent.change(input, { target: { value: "agent" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    await act(async () => {
      resolveSecond?.(
        jsonResponse({
          feeds: [
            {
              id: "feed-2",
              title: "Agent Search Weekly",
              type: "feed",
              url: "https://example.com/agent-search",
            },
          ],
          topics: [],
        }),
      );
      await Promise.resolve();
    });

    expect(screen.getByRole("option", { name: /Agent Search Weekly/i })).toBeInTheDocument();

    await act(async () => {
      resolveFirst?.(
        jsonResponse({
          feeds: [
            {
              id: "feed-1",
              title: "Agents Digest",
              type: "feed",
              url: "https://example.com/agents-digest",
            },
          ],
          topics: [],
        }),
      );
      await Promise.resolve();
    });

    expect(screen.queryByRole("option", { name: /Agents Digest/i })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Agent Search Weekly/i })).toBeInTheDocument();
  });

  it("uses DOM-safe IDs for multi-word topic suggestions in aria-activedescendant", async () => {
    const onSearch = vi.fn();
    fetchMock.mockResolvedValue(
      jsonResponse({
        feeds: [],
        topics: [
          {
            label: "machine learning",
            type: "topic",
            feed_count: 32,
          },
        ],
      }),
    );

    render(<SearchBar onSearch={onSearch} />);

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "machine" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", "topic-machine-learning-0");
    expect(screen.getByRole("option", { name: /machine learning/i })).toHaveAttribute(
      "id",
      "topic-machine-learning-0",
    );
  });
});

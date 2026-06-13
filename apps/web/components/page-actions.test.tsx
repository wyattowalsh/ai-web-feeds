import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LLMCopyButton } from "./page-actions";

const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");

function setClipboard(value: Partial<Clipboard>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value,
  });
}

describe("LLMCopyButton", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalClipboardDescriptor) {
      Object.defineProperty(navigator, "clipboard", originalClipboardDescriptor);
    } else {
      Reflect.deleteProperty(navigator, "clipboard");
    }
  });

  it("fetches markdown and writes via ClipboardItem when rich clipboard access exists", async () => {
    const write = vi.fn(async () => undefined);
    const fetchMock = vi.fn(async () => new Response("# Reader docs", { status: 200 }));
    class MockClipboardItem {
      constructor(public readonly items: Record<string, Blob>) {}
    }

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("ClipboardItem", MockClipboardItem);
    setClipboard({ write } as Partial<Clipboard>);

    render(<LLMCopyButton markdownUrl="/docs.mdx" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy Markdown" }));

    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/docs.mdx");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("uses writeText when ClipboardItem is unavailable and reuses cached markdown", async () => {
    const writeText = vi.fn(async () => undefined);
    const fetchMock = vi.fn(async () => new Response("# Markdown docs", { status: 200 }));

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("ClipboardItem", undefined);
    setClipboard({ writeText } as Partial<Clipboard>);

    render(<LLMCopyButton markdownUrl="/markdown.mdx" />);
    const button = screen.getByRole("button", { name: "Copy Markdown" });

    fireEvent.click(button);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("# Markdown docs"));

    fireEvent.click(button);
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to writeText when rich clipboard write rejects", async () => {
    const write = vi.fn(async () => {
      throw new Error("rich clipboard blocked");
    });
    const writeText = vi.fn(async () => undefined);
    const fetchMock = vi.fn(async () => new Response("# Plain docs", { status: 200 }));
    class MockClipboardItem {
      constructor(public readonly items: Record<string, Blob>) {}
    }

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("ClipboardItem", MockClipboardItem);
    setClipboard({ write, writeText } as Partial<Clipboard>);

    render(<LLMCopyButton markdownUrl="/plain.mdx" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy Markdown" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("# Plain docs"));
    expect(write).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows a copy error when markdown cannot be fetched", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("missing", { status: 404 })),
    );
    vi.stubGlobal("ClipboardItem", undefined);
    setClipboard({ writeText: vi.fn(async () => undefined) } as Partial<Clipboard>);

    render(<LLMCopyButton markdownUrl="/missing.mdx" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy Markdown" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Markdown source returned 404");
  });
});

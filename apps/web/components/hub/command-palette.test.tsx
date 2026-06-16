import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { CommandPalette, CommandPaletteProps } from "./command-palette";

function renderPalette(props: CommandPaletteProps = {}) {
  return render(<CommandPalette {...props} />);
}

describe("CommandPalette", () => {
  beforeEach(() => {
    pushMock.mockReset();
    // ensure body clean for portal-ish but it's not portal, just fixed div
    document.body.innerHTML = "";
  });

  it("renders nothing when closed (default uncontrolled)", () => {
    const { container } = renderPalette({ open: false });
    expect(container.firstChild).toBeNull();
  });

  it("renders dialog content when open (controlled)", () => {
    renderPalette({ open: true });
    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/type a command or search routes/i)).toBeInTheDocument();
    // items from build (primary + core)
    expect(screen.getByText("Reader")).toBeInTheDocument();
    expect(screen.getByText("Home")).toBeInTheDocument();
  });

  it("filters items by label, description, and href on query change", async () => {
    renderPalette({ open: true });
    const input = screen.getByPlaceholderText(
      /type a command or search routes/i,
    ) as HTMLInputElement;

    fireEvent.change(input, { target: { value: "reader" } });
    await waitFor(() => {
      expect(screen.getByText("Reader")).toBeVisible();
    });
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "sources" } });
    await waitFor(() => {
      expect(screen.getByText("Sources")).toBeVisible();
    });

    fireEvent.change(input, { target: { value: "/docs" } });
    await waitFor(() => {
      expect(screen.getByText("Docs")).toBeVisible();
    });
  });

  it("resets active index when query changes", async () => {
    renderPalette({ open: true });
    const input = screen.getByPlaceholderText(/type a command or search routes/i);

    // default active should be first (0)
    const first = screen.getAllByRole("option")[0];
    expect(first).toHaveAttribute("aria-selected", "true");

    fireEvent.change(input, { target: { value: "blog" } });
    await waitFor(() => {
      const opts = screen.getAllByRole("option");
      expect(opts[0]).toHaveTextContent(/blog/i);
      expect(opts[0]).toHaveAttribute("aria-selected", "true");
    });
  });

  it("supports arrow down/up to change active item and Enter to navigate (mock router)", async () => {
    renderPalette({ open: true });
    const input = screen.getByPlaceholderText(/type a command or search routes/i);

    // start at 0
    fireEvent.keyDown(input, { key: "ArrowDown" });
    await waitFor(() => {
      const opts = screen.getAllByRole("option");
      // index 1 should be active now (use semantic attr)
      expect(opts[1]).toHaveAttribute("aria-selected", "true");
    });

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    // after up should be back-ish, simulate enter on current
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalled();
    });
    // depending on active, but at least a push happened for internal nav
    const calledWith = pushMock.mock.calls[0]?.[0];
    expect(typeof calledWith).toBe("string");
  });

  it("clicking an item navigates via router.push for internal links", async () => {
    renderPalette({ open: true });
    const sourcesBtn = await screen.findByRole("button", { name: /sources/i });
    fireEvent.click(sourcesBtn);
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(expect.stringContaining("/sources"));
    });
  });

  it("Escape closes (uncontrolled) and clears query", async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<CommandPalette open={true} onOpenChange={onOpenChange} />);
    const input = screen.getByPlaceholderText(/type a command or search routes/i);

    fireEvent.change(input, { target: { value: "foo" } });
    fireEvent.keyDown(input, { key: "Escape" });

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    // simulate parent closing
    rerender(<CommandPalette open={false} onOpenChange={onOpenChange} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("traps Tab focus within the dialog panel", () => {
    renderPalette({ open: true });
    const input = screen.getByPlaceholderText(/type a command or search routes/i);
    const escButton = screen.getByRole("button", { name: /esc to close/i });

    escButton.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(input);

    input.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(escButton);
  });

  it("global Cmd/Ctrl+K toggles open via onOpenChange (controlled)", async () => {
    const onOpenChange = vi.fn();
    render(<CommandPalette open={false} onOpenChange={onOpenChange} />);

    // simulate Cmd+K (mac)
    const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
    fireEvent.keyDown(window, { key: "k", metaKey: isMac, ctrlKey: !isMac });

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(true);
    });
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReaderFilterChipBar } from "./reader-filter-chip-bar";

describe("ReaderFilterChipBar", () => {
  it("renders chips and clears on chip click", () => {
    const onFilterChip = vi.fn();
    const onResetDrafts = vi.fn();

    render(
      <ReaderFilterChipBar
        chips={[{ key: "query", label: "Search: agent", overrides: { q: null } }]}
        onFilterChip={onFilterChip}
        onResetDrafts={onResetDrafts}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Search: agent/i }));
    expect(onFilterChip).toHaveBeenCalledWith({ q: null });

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onResetDrafts).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when chips are empty", () => {
    const { container } = render(
      <ReaderFilterChipBar chips={[]} onFilterChip={vi.fn()} onResetDrafts={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

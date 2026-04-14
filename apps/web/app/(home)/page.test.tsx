/* eslint-disable @next/next/no-img-element, @typescript-eslint/no-unused-vars */

import { render, screen } from "@testing-library/react";
import type { ImgHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    priority: _priority,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => (
    <img {...props} alt={props.alt ?? ""} />
  ),
}));

async function loadHomePage() {
  const pageModule = await import("./page");
  return pageModule.default;
}

describe("HomePage", () => {
  it("surfaces Feeds as the primary entry and keeps support routes secondary", async () => {
    const HomePage = await loadHomePage();
    render(<HomePage />);

    expect(screen.getByRole("link", { name: "Open Feeds" })).toHaveAttribute("href", "/feeds");
    expect(screen.getByRole("link", { name: "Browse catalog" })).toHaveAttribute(
      "href",
      "/feeds?mode=catalog",
    );
    expect(screen.getByRole("link", { name: "Export from Feeds" })).toHaveAttribute(
      "href",
      "/feeds",
    );
    expect(screen.getByRole("link", { name: /Taxonomy/ })).toHaveAttribute("href", "/explorer");
    expect(screen.getAllByRole("link").some((link) => link.getAttribute("href") === "/docs")).toBe(
      true,
    );
  });
});

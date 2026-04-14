/* eslint-disable @next/next/no-img-element */
import { render, screen } from "@testing-library/react";
import type { ImgHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({
    fill,
    priority,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
    void fill;
    void priority;

    return <img {...props} alt={props.alt ?? ""} />;
  },
}));

async function loadHomePage() {
  const pageModule = await import("./page");
  return pageModule.default;
}

describe("HomePage", () => {
  it("surfaces the main public routes from the homepage", async () => {
    const HomePage = await loadHomePage();
    render(<HomePage />);

    expect(screen.getByRole("link", { name: "Open Feeds" })).toHaveAttribute("href", "/feeds");
    expect(screen.getByRole("link", { name: "Browse catalog" })).toHaveAttribute(
      "href",
      "/feeds?mode=catalog",
    );
    expect(screen.getByRole("link", { name: "Export feeds" })).toHaveAttribute(
      "href",
      "/downloads",
    );
    expect(screen.getAllByRole("link").some((link) => link.getAttribute("href") === "/docs")).toBe(
      true,
    );
  });
});

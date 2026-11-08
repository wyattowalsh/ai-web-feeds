import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChartSkeleton } from "@/components/analytics/chart-skeleton";

const source = readFileSync(join(process.cwd(), "components/analytics/chart-skeleton.tsx"), "utf8");

describe("ChartSkeleton", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a presentational placeholder and has no button that loads data", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<ChartSkeleton className="h-[32rem]" />);
    const skeleton = container.firstElementChild;

    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveClass("surface-card", "h-[32rem]");
    expect(skeleton?.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /load/i })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not fetch or import a chart runtime", () => {
    expect(source).toContain("export function ChartSkeleton");
    expect(source).not.toContain("fetch");
    expect(source).not.toContain("Math.random");
    expect(source).not.toMatch(/<button/i);
    expect(source).not.toMatch(/from ["']dexie["']/i);
    expect(source).not.toMatch(/from ["']three["']/);
    expect(source).not.toMatch(/ChartBuilder/);
  });
});

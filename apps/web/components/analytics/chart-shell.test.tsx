import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChartShell } from "./chart-shell";

const source = readFileSync(join(process.cwd(), "components/analytics/chart-shell.tsx"), "utf8");

describe("ChartShell", () => {
  it("renders children from props", () => {
    render(
      <ChartShell
        eyebrow="Velocity"
        title="Publication velocity"
        description="Counts passed in by the parent."
        footer={<p>footer note</p>}
      >
        <p>chart body</p>
      </ChartShell>,
    );

    expect(screen.getByText("Velocity")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Publication velocity" })).toBeInTheDocument();
    expect(screen.getByText("Counts passed in by the parent.")).toBeInTheDocument();
    expect(screen.getByText("chart body")).toBeInTheDocument();
    expect(screen.getByText("footer note")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Publication velocity" })).toHaveAttribute(
      "data-state",
      "ready",
    );
    expect(screen.getByRole("region", { name: "Publication velocity" })).toHaveAttribute(
      "data-demo",
      "false",
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders the empty state inside the shell", () => {
    render(
      <ChartShell title="Publication velocity" description="Counts passed in by the parent." empty>
        <p>chart body</p>
      </ChartShell>,
    );

    const emptyState = screen.getByRole("status");
    expect(emptyState).toHaveAttribute("data-state", "empty");
    expect(emptyState).toHaveTextContent("No data");
    expect(emptyState).toHaveTextContent("This chart is empty.");
    expect(screen.queryByText("chart body")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Publication velocity" })).toBeInTheDocument();
  });

  it("renders the error state inside the shell", () => {
    render(
      <ChartShell
        title="Publication velocity"
        description="Counts passed in by the parent."
        error="Failed to load"
        empty
      >
        <p>chart body</p>
      </ChartShell>,
    );

    const errorState = screen.getByRole("alert");
    expect(errorState).toHaveAttribute("data-state", "error");
    expect(errorState).toHaveTextContent("Chart error");
    expect(errorState).toHaveTextContent("Failed to load");
    expect(screen.queryByText("chart body")).not.toBeInTheDocument();
    expect(screen.queryByText("No data")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Publication velocity" })).toBeInTheDocument();
  });

  it("does not fetch or invent chart data", () => {
    expect(source).toContain("export function ChartShell");
    expect(source).toContain('data-demo="false"');
    expect(source.includes("fetch" + "(")).toBe(false);
    expect(source.includes("Math" + ".random")).toBe(false);
    expect(source.includes("Dexie")).toBe(false);
    expect(source.includes('from "three"')).toBe(false);
    expect(source.includes("Chart" + "Builder")).toBe(false);
    expect(source.includes("demo" + ": true")).toBe(false);
  });
});

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GraphVisualizer,
  getDefaultGraphControls,
  type GraphControls,
  type LayoutType,
} from "@/components/graph-visualizer";
import type { TopicRecord } from "@/lib/catalog-types";

const componentSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "graph-visualizer.tsx"),
  "utf8",
);

/** One real catalog topic and no edges. Relations to other topics are omitted. */
const catalogTopic: TopicRecord = {
  id: "ai",
  label: "Artificial Intelligence",
  facet: "domain",
  facet_group: "conceptual",
  description: "Umbrella for all AI-related content; ancestor of most topics.",
  aliases: ["artificial-intelligence"],
  parents: [],
  relations: {},
  rank_hint: 1,
};

function renderTopicsGraph(
  layout: LayoutType = "force",
  graphControls: GraphControls = getDefaultGraphControls("topics"),
) {
  return render(
    <GraphVisualizer
      data={[catalogTopic]}
      type="topics"
      width={1200}
      height={800}
      layout={layout}
      onLayoutChange={vi.fn()}
      graphControls={graphControls}
      onGraphControlsChange={vi.fn()}
      onNodeClick={vi.fn()}
      onDetailAction={vi.fn()}
    />,
  );
}

describe("GraphVisualizer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders one catalog topic in 2D without throwing, fetching, or referencing three", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(renderTopicsGraph).not.toThrow();

    const svg = screen.getByRole("img", { name: "Topics network graph" });
    expect(svg.tagName.toLowerCase()).toBe("svg");
    expect(svg.querySelectorAll("circle")).toHaveLength(1);
    expect(svg.querySelectorAll("line")).toHaveLength(0);
    expect(screen.getByText("Artificial Intelligence")).toBeInTheDocument();
    expect(screen.getByText(/interactive topics graph/i)).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /3d/i })).not.toBeInTheDocument();
    expect(document.querySelector("canvas")).toBeNull();
    expect(document.body.textContent ?? "").not.toMatch(/\bdemo\b|forecast/i);
    expect(fetchMock).not.toHaveBeenCalled();

    expect(componentSource).toContain("export function GraphVisualizer");
    expect(componentSource).toContain("export function getDefaultGraphControls");
    expect(componentSource).not.toMatch(/from ["']three["']/);
    expect(componentSource).not.toMatch(/@react-three\/(?:fiber|drei)/);
    expect(componentSource).not.toMatch(/Math\.random/);
    expect(componentSource).not.toMatch(/demo:\s*true/);
    expect(componentSource).not.toMatch(/forecast/i);
  });

  it("keeps 2D topic controls and does not enable a demo series", () => {
    expect(GraphVisualizer).toEqual(expect.any(Function));
    expect(getDefaultGraphControls).toEqual(expect.any(Function));
    expect(getDefaultGraphControls("topics")).toEqual({
      chargeStrength: 280,
      linkDistance: 120,
      collisionRadius: 18,
      nodeScale: 1,
      labelSize: 12,
      showLabels: true,
    });
    expect(getDefaultGraphControls("topics")).not.toHaveProperty("demo");
    expect(getDefaultGraphControls("topics")).not.toHaveProperty("forecast");
    expect(catalogTopic.parents).toEqual([]);
    expect(catalogTopic.relations).toEqual({});
  });
});

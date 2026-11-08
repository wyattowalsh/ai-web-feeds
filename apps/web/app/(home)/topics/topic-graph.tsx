"use client";

import { useState } from "react";
import {
  GraphVisualizer,
  getDefaultGraphControls,
  type GraphControls,
  type LayoutType,
} from "@/components/graph-visualizer";
import type { TopicRecord } from "@/lib/catalog-types";

export function TopicGraph({
  data,
  visualizer: Visualizer,
  initialControls,
}: {
  data: TopicRecord[];
  visualizer: typeof GraphVisualizer;
  initialControls?: GraphControls;
}) {
  const [layout, setLayout] = useState<LayoutType>("force");
  const [graphControls, setGraphControls] = useState<GraphControls>(
    initialControls ?? getDefaultGraphControls("topics"),
  );

  return (
    <Visualizer
      data={data}
      type="topics"
      width={1200}
      height={800}
      layout={layout}
      onLayoutChange={setLayout}
      graphControls={graphControls}
      onGraphControlsChange={setGraphControls}
    />
  );
}

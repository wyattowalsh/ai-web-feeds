"use client";

import { useState } from "react";
import {
  GraphVisualizer,
  getDefaultGraphControls,
  type LayoutType,
  type GraphControls,
} from "@/components/graph-visualizer";
import type { TopicRecord } from "@/lib/catalog-types";

interface ExplorerClientProps {
  topics: TopicRecord[];
}

export function ExplorerClient({ topics }: ExplorerClientProps) {
  const [layout, setLayout] = useState<LayoutType>("force");
  const [graphControls, setGraphControls] = useState<GraphControls>(
    getDefaultGraphControls("topics"),
  );

  return (
    <GraphVisualizer
      data={topics}
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

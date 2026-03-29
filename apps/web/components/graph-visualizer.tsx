"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  drag,
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  select,
  stratify,
  tree,
  zoom,
  type D3DragEvent,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3";
import {
  normalizeTopicValues,
  type CatalogFeed,
  type CombinedCatalogGraphData,
  type TopicRecord,
} from "@/lib/catalog-types";

interface GraphNode extends SimulationNodeDatum {
  id: string;
  label: string;
  group: string;
  description?: string;
  facet?: string;
  parents?: string[];
  relations?: Record<string, string[]>;
  size?: number;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
  value: number;
}

export type LayoutType = "force" | "radial" | "tree" | "circular";

export interface GraphControls {
  chargeStrength: number;
  linkDistance: number;
  collisionRadius: number;
  nodeScale: number;
  labelSize: number;
  showLabels: boolean;
}

export interface GraphDetailAction {
  action: "open-topics" | "open-feeds" | "copy-id" | "open-url";
  nodeId: string;
  nodeType: "topic" | "feed";
}

interface ConnectionDetail {
  id: string;
  label: string;
  group: string;
  edgeTypes: string[];
}

interface GraphVisualizerProps {
  data: TopicRecord[] | CatalogFeed[] | CombinedCatalogGraphData;
  type: "topics" | "feeds" | "combined";
  width?: number;
  height?: number;
  layout: LayoutType;
  onLayoutChange: (layout: LayoutType) => void;
  graphControls: GraphControls;
  onGraphControlsChange: React.Dispatch<React.SetStateAction<GraphControls>>;
  onNodeClick?: (nodeId: string, nodeType: "topic" | "feed") => void;
  onDetailAction?: (action: GraphDetailAction) => void;
}

export function GraphVisualizer({
  data,
  type,
  width = 1200,
  height = 800,
  layout,
  onLayoutChange,
  graphControls,
  onGraphControlsChange,
  onNodeClick,
  onDetailAction,
}: GraphVisualizerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightGroup, setHighlightGroup] = useState<string | null>(null);

  // Process data into graph structure
  const graphData = useMemo(() => {
    if (type === "topics") {
      return processTopicsData(data as TopicRecord[]);
    }

    if (type === "feeds") {
      return processFeedsData(data as CatalogFeed[]);
    }

    return processCombinedData(data as CombinedCatalogGraphData);
  }, [data, type]);

  useEffect(() => {
    setSelectedNode(null);
  }, [type]);

  const nodeById = useMemo(
    () => new Map(graphData.nodes.map((node) => [node.id, node])),
    [graphData.nodes],
  );

  const selectedNodeConnections = useMemo(() => {
    if (!selectedNode) return { topics: [] as ConnectionDetail[], feeds: [] as ConnectionDetail[] };

    const relatedNodes = new Map<string, ConnectionDetail>();

    graphData.links.forEach((link) => {
      const sourceId = typeof link.source === "string" ? link.source : link.source.id;
      const targetId = typeof link.target === "string" ? link.target : link.target.id;

      if (sourceId !== selectedNode.id && targetId !== selectedNode.id) return;

      const neighborId = sourceId === selectedNode.id ? targetId : sourceId;
      const neighborNode = nodeById.get(neighborId);
      if (!neighborNode) return;

      const existing = relatedNodes.get(neighborId);
      if (existing) {
        if (!existing.edgeTypes.includes(link.type)) {
          existing.edgeTypes.push(link.type);
        }
        return;
      }

      relatedNodes.set(neighborId, {
        id: neighborNode.id,
        label: neighborNode.label,
        group: neighborNode.group,
        edgeTypes: [link.type],
      });
    });

    const allConnections = Array.from(relatedNodes.values()).sort((left, right) =>
      left.label.localeCompare(right.label),
    );

    return {
      topics: allConnections.filter((connection) => connection.group !== "feed"),
      feeds: allConnections.filter((connection) => connection.group === "feed"),
    };
  }, [graphData.links, nodeById, selectedNode]);

  useEffect(() => {
    if (!svgRef.current || !graphData.nodes.length) return;

    // Validate that all links reference existing nodes
    const nodeIds = new Set(graphData.nodes.map((n) => n.id));
    const validLinks = graphData.links.filter((link) => {
      const sourceId =
        typeof link.source === "string" ? link.source : (link.source as GraphNode).id;
      const targetId =
        typeof link.target === "string" ? link.target : (link.target as GraphNode).id;
      return nodeIds.has(sourceId) && nodeIds.has(targetId);
    });

    if (validLinks.length === 0 && graphData.links.length > 0) {
      console.warn("No valid links found - all links reference non-existent nodes");
    }

    // Clear previous visualization
    select(svgRef.current).selectAll("*").remove();

    const svg = select(svgRef.current);
    const container = svg.append("g");

    // Add zoom behavior
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
      });

    svg.call(zoomBehavior);

    // Apply layout-specific positioning
    let simulation: ReturnType<typeof forceSimulation<GraphNode>> = forceSimulation<GraphNode>([]);

    if (layout === "force") {
      // Force-directed layout
      simulation = forceSimulation<GraphNode>(graphData.nodes)
        .force(
          "link",
          forceLink<GraphNode, GraphLink>(validLinks)
            .id((d) => d.id)
            .distance((d) =>
              d.type === "parent"
                ? Math.max(60, graphControls.linkDistance * 0.72)
                : graphControls.linkDistance,
            )
            .strength((d) => (d.type === "parent" ? 1 : 0.5)),
        )
        .force("charge", forceManyBody().strength(-graphControls.chargeStrength))
        .force("center", forceCenter(width / 2, height / 2))
          .force(
            "collision",
            forceCollide<GraphNode>().radius(
              (node) => getNodeRadius(node, graphControls.nodeScale) + graphControls.collisionRadius,
            ),
          );
    } else if (layout === "radial") {
      // Radial layout - nodes arranged in concentric circles by group
      const groups = Array.from(new Set(graphData.nodes.map((n) => n.group)));
      const radius = Math.min(width, height) / 3;

      graphData.nodes.forEach((node) => {
        const groupIndex = groups.indexOf(node.group);
        const nodesInGroup = graphData.nodes.filter((n) => n.group === node.group).length;
        const nodeIndexInGroup = graphData.nodes
          .filter((n) => n.group === node.group)
          .indexOf(node);
        const angle = (nodeIndexInGroup / nodesInGroup) * 2 * Math.PI;
        const r = radius + groupIndex * 100;

        node.x = width / 2 + r * Math.cos(angle);
        node.y = height / 2 + r * Math.sin(angle);
        node.fx = node.x;
        node.fy = node.y;
      });

      simulation = forceSimulation<GraphNode>(graphData.nodes)
        .force(
          "link",
          forceLink<GraphNode, GraphLink>(validLinks)
            .id((d) => d.id)
            .distance(graphControls.linkDistance),
        )
          .force(
            "collision",
            forceCollide<GraphNode>().radius(
              (node) => getNodeRadius(node, graphControls.nodeScale) + graphControls.collisionRadius / 2,
            ),
          )
        .alpha(0.1)
        .alphaDecay(0.05);
    } else if (layout === "tree") {
      // Hierarchical tree layout
      const root =
        graphData.nodes.find((n) => !n.parents || n.parents.length === 0) || graphData.nodes[0];
      const hierarchy = stratify<GraphNode>()
        .id((d) => d.id)
        .parentId((d) => {
          if (d.parents && d.parents.length > 0) return d.parents[0];
          return d.id === root.id ? null : root.id;
        })(graphData.nodes);

      const treeLayout = tree<GraphNode>().size([width - 100, height - 100]);
      const treeData = treeLayout(hierarchy);

      treeData.descendants().forEach((treeNode) => {
        const dataNode = graphData.nodes.find((n) => n.id === treeNode.data.id);
        if (dataNode) {
          dataNode.x = treeNode.x + 50;
          dataNode.y = treeNode.y + 50;
          dataNode.fx = dataNode.x;
          dataNode.fy = dataNode.y;
        }
      });

      simulation = forceSimulation<GraphNode>(graphData.nodes)
        .force(
          "link",
          forceLink<GraphNode, GraphLink>(validLinks)
            .id((d) => d.id)
            .distance(Math.max(40, graphControls.linkDistance * 0.5)),
        )
          .force(
            "collision",
            forceCollide<GraphNode>().radius(
              (node) => getNodeRadius(node, graphControls.nodeScale) + graphControls.collisionRadius / 3,
            ),
          )
        .alpha(0.1)
        .alphaDecay(0.05);
    } else if (layout === "circular") {
      // Circular layout - all nodes in a circle
      const radius = Math.min(width, height) / 2 - 50;
      graphData.nodes.forEach((node, i) => {
        const angle = (i / graphData.nodes.length) * 2 * Math.PI;
        node.x = width / 2 + radius * Math.cos(angle);
        node.y = height / 2 + radius * Math.sin(angle);
        node.fx = node.x;
        node.fy = node.y;
      });

      simulation = forceSimulation<GraphNode>(graphData.nodes)
        .force(
          "link",
          forceLink<GraphNode, GraphLink>(validLinks)
            .id((d) => d.id)
            .distance(graphControls.linkDistance),
        )
          .force(
            "collision",
            forceCollide<GraphNode>().radius(
              (node) => getNodeRadius(node, graphControls.nodeScale) + graphControls.collisionRadius / 2,
            ),
          )
        .alpha(0.1)
        .alphaDecay(0.05);
    }

    // Create arrow markers for directed edges
    const defs = svg.append("defs");

    ["parent", "depends_on", "influences", "related_to"].forEach((linkType) => {
      defs
        .append("marker")
        .attr("id", `arrow-${linkType}`)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 20)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", getLinkColor(linkType));
    });

    // Draw links - use validLinks instead of graphData.links
    const link = container
      .append("g")
      .selectAll("line")
      .data(validLinks)
      .join("line")
      .attr("stroke", (d) => getLinkColor(d.type))
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (d) => Math.sqrt(d.value))
      .attr("marker-end", (d) => `url(#arrow-${d.type})`);

    // Draw nodes
    const dragBehavior = drag<SVGGElement, GraphNode>()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);

    const node = container
      .append("g")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(graphData.nodes)
      .join("g");
    node.call(dragBehavior);

    // Node circles
    node
      .append("circle")
      .attr("r", (d) => getNodeRadius(d, graphControls.nodeScale))
      .attr("fill", (d) => getNodeColor(d.group, d.facet))
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .on("mouseover", function (_event, d) {
        select(this)
          .transition()
          .duration(200)
          .attr("r", getNodeRadius(d, graphControls.nodeScale) * 1.5);
        setSelectedNode(d);
      })
      .on("mouseout", function (_event, d) {
        select(this)
          .transition()
          .duration(200)
          .attr("r", getNodeRadius(d, graphControls.nodeScale));
      })
      .on("click", (event, d) => {
        setSelectedNode(d);
        // Deep linking: notify parent component about node click
        if (onNodeClick) {
          const nodeType = d.group === "feed" ? "feed" : "topic";
          onNodeClick(d.id, nodeType);
        }
        event.stopPropagation();
      });

    // Node labels
    node
      .append("text")
      .text((d) => d.label)
      .attr("x", 12)
      .attr("y", 4)
      .attr("font-size", graphControls.labelSize)
      .attr("fill", "#333")
      .style("display", graphControls.showLabels ? "block" : "none")
      .style("pointer-events", "none")
      .style("user-select", "none");

    // Update positions on simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x || 0)
        .attr("y1", (d) => (d.source as GraphNode).y || 0)
        .attr("x2", (d) => (d.target as GraphNode).x || 0)
        .attr("y2", (d) => (d.target as GraphNode).y || 0);

      node.attr("transform", (d) => `translate(${d.x || 0},${d.y || 0})`);
    });

    // Drag functions
    function dragstarted(event: D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0);
      // In non-force layouts, keep nodes fixed
      if (layout !== "force") {
        d.fx = event.x;
        d.fy = event.y;
      } else {
        d.fx = null;
        d.fy = null;
      }
    }

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [graphData, width, height, layout, onNodeClick, graphControls]);

  // Filter nodes based on search
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = select(svgRef.current);
    const nodes = svg.selectAll("g g");
    const searchValue = searchTerm.toLowerCase();

    nodes.each(function (d) {
      const node = select(this);
      const graphNode = d as GraphNode;
      const matches =
        searchTerm === "" ||
        graphNode.label.toLowerCase().includes(searchValue) ||
        graphNode.id.toLowerCase().includes(searchValue) ||
        graphNode.description?.toLowerCase().includes(searchValue);

      const groupMatches =
        !highlightGroup || graphNode.group === highlightGroup || graphNode.facet === highlightGroup;

      node.style("opacity", matches && groupMatches ? 1 : 0.1);
    });
  }, [searchTerm, highlightGroup]);

  const groups = useMemo(() => {
    const groupSet = new Set<string>();
    graphData.nodes.forEach((n) => {
      if (n.group) groupSet.add(n.group);
      if (n.facet) groupSet.add(n.facet);
    });
    return Array.from(groupSet).sort();
  }, [graphData]);

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-50">
            <label htmlFor="graph-search" className="sr-only">
              Search graph nodes
            </label>
            <input
              id="graph-search"
              type="text"
              placeholder="Search nodes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div className="flex gap-2 items-center">
            <label htmlFor="graph-layout" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Layout:
            </label>
            <select
              id="graph-layout"
              value={layout}
              onChange={(e) => onLayoutChange(e.target.value as LayoutType)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="force">Force-Directed</option>
              <option value="radial">Radial</option>
              <option value="tree">Tree</option>
              <option value="circular">Circular</option>
            </select>
          </div>

          <div className="flex gap-2 items-center">
            <label htmlFor="graph-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Filter:
            </label>
            <select
              id="graph-filter"
              value={highlightGroup || ""}
              onChange={(e) => setHighlightGroup(e.target.value || null)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All</option>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setHighlightGroup(null);
                onLayoutChange("force");
                onGraphControlsChange(getDefaultGraphControls(type));
              }}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors text-gray-900 dark:text-white"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 border-t border-gray-200 dark:border-gray-700 pt-4">
          <GraphRangeControl
            id="graph-charge"
            label="Repulsion"
            min={50}
            max={900}
            step={25}
            value={graphControls.chargeStrength}
            onChange={(value) =>
              onGraphControlsChange((current) => ({ ...current, chargeStrength: value }))
            }
          />
          <GraphRangeControl
            id="graph-link-distance"
            label="Edge Length"
            min={40}
            max={240}
            step={5}
            value={graphControls.linkDistance}
            onChange={(value) =>
              onGraphControlsChange((current) => ({ ...current, linkDistance: value }))
            }
          />
          <GraphRangeControl
            id="graph-collision"
            label="Node Spacing"
            min={4}
            max={40}
            step={1}
            value={graphControls.collisionRadius}
            onChange={(value) =>
              onGraphControlsChange((current) => ({ ...current, collisionRadius: value }))
            }
          />
          <GraphRangeControl
            id="graph-node-scale"
            label="Node Size"
            min={0.6}
            max={1.8}
            step={0.1}
            value={graphControls.nodeScale}
            onChange={(value) =>
              onGraphControlsChange((current) => ({ ...current, nodeScale: value }))
            }
          />
          <div className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 px-3 py-3">
            <GraphRangeControl
              id="graph-label-size"
              label="Label Size"
              min={10}
              max={18}
              step={1}
              value={graphControls.labelSize}
              onChange={(value) =>
                onGraphControlsChange((current) => ({ ...current, labelSize: value }))
              }
            />
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={graphControls.showLabels}
                onChange={(event) =>
                  onGraphControlsChange((current) => ({
                    ...current,
                    showLabels: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Show Labels
            </label>
          </div>
        </div>
      </div>

      {/* Graph and Info Panel */}
      <div className="flex gap-4">
        {/* SVG Graph */}
        <div className="flex-1 border rounded-lg bg-white shadow-sm overflow-hidden">
          <p id="graph-description" className="sr-only">
            Interactive {type === "topics" ? "topics" : type === "feeds" ? "feeds" : "combined topic and feed"} graph. Use drag to pan, scroll to zoom, and click a node to inspect its details in the adjacent panel.
          </p>
          <svg
            ref={svgRef}
            width={width}
            height={height}
            className="cursor-move"
            onClick={() => setSelectedNode(null)}
            role="img"
            aria-label={`${type === "topics" ? "Topics" : type === "feeds" ? "Feeds" : "Combined topic and feed"} network graph`}
            aria-describedby="graph-description"
          />
        </div>

        {/* Info Panel */}
        {selectedNode && (
          <div className="w-80 max-h-200 overflow-y-auto border rounded-lg bg-white shadow-lg p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-gray-900">{selectedNode.label}</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onDetailAction?.({
                        action: selectedNode.group === "feed" ? "open-feeds" : "open-topics",
                        nodeId: selectedNode.id,
                        nodeType: selectedNode.group === "feed" ? "feed" : "topic",
                      })
                    }
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    {selectedNode.group === "feed" ? "Open feeds view" : "Open topics view"}
                  </button>
                  {selectedNode.group !== "feed" && selectedNodeConnections.feeds.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        onDetailAction?.({
                          action: "open-feeds",
                          nodeId: selectedNode.id,
                          nodeType: "topic",
                        })
                      }
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition-colors"
                    >
                      Open related feeds
                    </button>
                  )}
                  {selectedNode.group === "feed" && selectedNode.description && (
                    <button
                      type="button"
                      onClick={() =>
                        onDetailAction?.({
                          action: "open-url",
                          nodeId: selectedNode.id,
                          nodeType: "feed",
                        })
                      }
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors"
                    >
                      Open source URL
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      onDetailAction?.({
                        action: "copy-id",
                        nodeId: selectedNode.id,
                        nodeType: selectedNode.group === "feed" ? "feed" : "topic",
                      })
                    }
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Copy ID
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close node details"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <div>
                <span className="text-sm font-medium text-gray-500">ID:</span>
                <p className="font-mono text-sm">{selectedNode.id}</p>
              </div>

              {selectedNode.description && (
                <div>
                  <span className="text-sm font-medium text-gray-500">Description:</span>
                  <p className="text-sm text-gray-700">{selectedNode.description}</p>
                </div>
              )}

              {selectedNode.facet && (
                <div>
                  <span className="text-sm font-medium text-gray-500">Facet:</span>
                  <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                    {selectedNode.facet}
                  </span>
                </div>
              )}

              {selectedNode.group && (
                <div>
                  <span className="text-sm font-medium text-gray-500">Group:</span>
                  <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                    {selectedNode.group}
                  </span>
                </div>
              )}

              {selectedNode.parents && selectedNode.parents.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-gray-500">Parents:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedNode.parents.map((p, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedNode.relations && Object.keys(selectedNode.relations).length > 0 && (
                <div>
                  <span className="text-sm font-medium text-gray-500">Relations:</span>
                  <div className="mt-1 space-y-1">
                    {Object.entries(selectedNode.relations).map(([type, targets]) => (
                      <div key={type} className="text-sm">
                        <span className="font-medium capitalize">{type.replace(/_/g, " ")}:</span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {(targets as string[]).map((t, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedNodeConnections.topics.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-gray-500">Connected Topics:</span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedNodeConnections.topics.slice(0, 16).map((connection) => (
                      <button
                        type="button"
                        key={connection.id}
                        onClick={() =>
                          onDetailAction?.({
                            action: "open-topics",
                            nodeId: connection.id,
                            nodeType: "topic",
                          })
                        }
                        className="px-2 py-1 bg-cyan-100 hover:bg-cyan-200 text-cyan-800 rounded text-xs transition-colors"
                        title={connection.edgeTypes.join(", ")}
                      >
                        {connection.label}
                      </button>
                    ))}
                  </div>
                  {selectedNodeConnections.topics.length > 16 && (
                    <p className="mt-2 text-xs text-gray-500">
                      +{selectedNodeConnections.topics.length - 16} more topic connections
                    </p>
                  )}
                </div>
              )}

              {selectedNodeConnections.feeds.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-gray-500">Connected Feeds:</span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedNodeConnections.feeds.slice(0, 12).map((connection) => (
                      <button
                        type="button"
                        key={connection.id}
                        onClick={() =>
                          onDetailAction?.({
                            action: "open-feeds",
                            nodeId: connection.id,
                            nodeType: "feed",
                          })
                        }
                        className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded text-xs transition-colors"
                        title={connection.edgeTypes.join(", ")}
                      >
                        {connection.label}
                      </button>
                    ))}
                  </div>
                  {selectedNodeConnections.feeds.length > 12 && (
                    <p className="mt-2 text-xs text-gray-500">
                      +{selectedNodeConnections.feeds.length - 12} more feed connections
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="bg-white p-4 rounded-lg border shadow-sm">
        <h4 className="font-semibold mb-2">Legend</h4>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500"></div>
            <span>Domain/Subfield</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500"></div>
            <span>Task/Method</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-purple-500"></div>
            <span>Research/Governance</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-orange-500"></div>
            <span>Infrastructure</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500"></div>
            <span>Feed Source</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-gray-400"></div>
            <span>Parent</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-blue-400"></div>
            <span>Depends On</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-green-400"></div>
            <span>Related To</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function GraphRangeControl({
  id,
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="space-y-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 px-3 py-3"
    >
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="font-mono text-gray-500 dark:text-gray-400">{value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-blue-600"
      />
    </label>
  );
}

// Helper functions
export function getDefaultGraphControls(type: GraphVisualizerProps["type"]): GraphControls {
  if (type === "topics") {
    return {
      chargeStrength: 280,
      linkDistance: 120,
      collisionRadius: 18,
      nodeScale: 1,
      labelSize: 12,
      showLabels: true,
    };
  }

  if (type === "feeds") {
    return {
      chargeStrength: 240,
      linkDistance: 90,
      collisionRadius: 14,
      nodeScale: 0.95,
      labelSize: 11,
      showLabels: true,
    };
  }

  return {
    chargeStrength: 340,
    linkDistance: 140,
    collisionRadius: 16,
    nodeScale: 0.95,
    labelSize: 11,
    showLabels: true,
  };
}

function getNodeRadius(node: GraphNode, nodeScale: number): number {
  return (node.size || 8) * nodeScale;
}

function buildTopicGraph(topics: TopicRecord[]): { nodes: GraphNode[]; links: GraphLink[] } {
  if (!topics || topics.length === 0) {
    return { nodes: [], links: [] };
  }

  const nodes: GraphNode[] = topics.map((t) => ({
    id: t.id,
    label: t.label || t.id,
    group: t.facet_group || "other",
    facet: t.facet,
      description: t.description ?? undefined,
    parents: t.parents || [],
    relations: t.relations || {},
    size: 8 + (t.rank_hint || 0.5) * 10,
  }));

  // Create a Set of valid node IDs for quick lookup
  const nodeIds = new Set(nodes.map((n) => n.id));
  const links: GraphLink[] = [];

  topics.forEach((topic) => {
    // Parent relationships - only add if both nodes exist
    if (topic.parents && Array.isArray(topic.parents)) {
      topic.parents.forEach((parent: string) => {
        if (nodeIds.has(parent) && nodeIds.has(topic.id)) {
          links.push({
            source: topic.id,
            target: parent,
            type: "parent",
            value: 2,
          });
        }
      });
    }

    // Other relations - only add if both nodes exist
    if (topic.relations) {
      Object.entries(topic.relations).forEach(([relType, targets]) => {
        if (Array.isArray(targets)) {
          targets.forEach((target) => {
            if (nodeIds.has(target) && nodeIds.has(topic.id)) {
              links.push({
                source: topic.id,
                target,
                type: relType,
                value: 1,
              });
            }
          });
        }
      });
    }
  });

  return { nodes, links };
}

function processTopicsData(topics: TopicRecord[]): { nodes: GraphNode[]; links: GraphLink[] } {
  return buildTopicGraph(topics);
}

function processFeedsData(feeds: CatalogFeed[]): { nodes: GraphNode[]; links: GraphLink[] } {
  if (!feeds || feeds.length === 0) {
    return { nodes: [], links: [] };
  }

  const topicNodes = new Map<string, GraphNode>();
  const feedNodes: GraphNode[] = [];
  const links: GraphLink[] = [];

  feeds.forEach((feed, idx) => {
    const feedId = `feed-${idx}`;
    feedNodes.push({
      id: feedId,
      label: feed.title || feed.url || `Feed ${idx}`,
      group: "feed",
      description: feed.url,
      size: 6,
    });

    const topicsArray = normalizeTopicValues(feed.topics ?? feed.tags);

    topicsArray.forEach((topic: string) => {
      if (!topic) return; // Skip empty topics

      if (!topicNodes.has(topic)) {
        topicNodes.set(topic, {
          id: topic,
          label: topic,
          group: "topic",
          size: 10,
        });
      }

      links.push({
        source: feedId,
        target: topic,
        type: "related_to",
        value: 1,
      });
    });
  });

  return {
    nodes: [...feedNodes, ...Array.from(topicNodes.values())],
    links,
  };
}

function processCombinedData(data: CombinedCatalogGraphData): {
  nodes: GraphNode[];
  links: GraphLink[];
} {
  const { nodes: topicNodes, links: topicLinks } = buildTopicGraph(data.topics);
  const topicNodeMap = new Map(topicNodes.map((node) => [node.id, node]));
  const feedNodes: GraphNode[] = [];
  const feedLinks: GraphLink[] = [];

  data.feeds.forEach((feed, idx) => {
    const feedNodeId = `feed:${feed.id ?? idx}`;
    const connectedTopics = normalizeTopicValues(feed.topics ?? feed.tags);

    feedNodes.push({
      id: feedNodeId,
      label: feed.title || feed.url || `Feed ${idx + 1}`,
      group: "feed",
      facet: feed.source_type,
      description: feed.notes || feed.description || feed.url,
      relations: connectedTopics.length > 0 ? { related_to: connectedTopics } : {},
      size: 7,
    });

    connectedTopics.forEach((topicId) => {
      if (!topicNodeMap.has(topicId)) {
        const syntheticTopicNode: GraphNode = {
          id: topicId,
          label: topicId,
          group: "topic",
          size: 10,
        };
        topicNodeMap.set(topicId, syntheticTopicNode);
      }

      feedLinks.push({
        source: feedNodeId,
        target: topicId,
        type: "related_to",
        value: 1,
      });
    });
  });

  return {
    nodes: [...topicNodeMap.values(), ...feedNodes],
    links: [...topicLinks, ...feedLinks],
  };
}

function getNodeColor(group: string, facet?: string): string {
  const colors: Record<string, string> = {
    conceptual: "#3b82f6",
    governance: "#8b5cf6",
    interactional: "#10b981",
    infrastructure: "#f59e0b",
    feed: "#ef4444",
    topic: "#06b6d4",
    domain: "#3b82f6",
    task: "#10b981",
    research: "#8b5cf6",
    safety: "#ef4444",
  };

  return colors[group] || colors[facet || ""] || "#6b7280";
}

function getLinkColor(type: string): string {
  const colors: Record<string, string> = {
    parent: "#9ca3af",
    depends_on: "#3b82f6",
    influences: "#f59e0b",
    related_to: "#10b981",
    implements: "#8b5cf6",
  };

  return colors[type] || "#d1d5db";
}

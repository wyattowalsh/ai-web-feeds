"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  group: string;
  description?: string;
  facet?: string;
  parents?: string[];
  relations?: Record<string, string[]>;
  size?: number;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
  value: number;
}

type LayoutType = "force" | "radial" | "tree" | "circular";

interface GraphVisualizerProps {
  data: any[];
  type: "topics" | "feeds";
  width?: number;
  height?: number;
  onNodeClick?: (nodeId: string, nodeType: "topic" | "feed") => void;
}

export function GraphVisualizer({
  data,
  type,
  width = 1200,
  height = 800,
  onNodeClick,
}: GraphVisualizerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightGroup, setHighlightGroup] = useState<string | null>(null);
  const [layout, setLayout] = useState<LayoutType>("force");

  // Process data into graph structure
  const graphData = useMemo(() => {
    if (type === "topics") {
      return processTopicsData(data);
    } else {
      return processFeedsData(data);
    }
  }, [data, type]);

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
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current);
    const container = svg.append("g");

    // Add zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Apply layout-specific positioning
    let simulation: any;

    if (layout === "force") {
      // Force-directed layout
      simulation = d3
        .forceSimulation<GraphNode>(graphData.nodes)
        .force(
          "link",
          d3
            .forceLink<GraphNode, GraphLink>(validLinks)
            .id((d) => d.id)
            .distance((d) => (d.type === "parent" ? 100 : 150))
            .strength((d) => (d.type === "parent" ? 1 : 0.5)),
        )
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(30));
    } else if (layout === "radial") {
      // Radial layout - nodes arranged in concentric circles by group
      const groups = Array.from(new Set(graphData.nodes.map((n) => n.group)));
      const radius = Math.min(width, height) / 3;

      graphData.nodes.forEach((node, i) => {
        const groupIndex = groups.indexOf(node.group);
        const nodesInGroup = graphData.nodes.filter((n) => n.group === node.group).length;
        const nodeIndexInGroup = graphData.nodes
          .filter((n) => n.group === node.group)
          .indexOf(node);
        const angle = (nodeIndexInGroup / nodesInGroup) * 2 * Math.PI;
        const r = radius + groupIndex * 100;

        (node as any).x = width / 2 + r * Math.cos(angle);
        (node as any).y = height / 2 + r * Math.sin(angle);
        (node as any).fx = (node as any).x;
        (node as any).fy = (node as any).y;
      });

      simulation = d3
        .forceSimulation<GraphNode>(graphData.nodes)
        .force(
          "link",
          d3
            .forceLink<GraphNode, GraphLink>(validLinks)
            .id((d) => d.id)
            .distance(100),
        )
        .alpha(0.1)
        .alphaDecay(0.05);
    } else if (layout === "tree") {
      // Hierarchical tree layout
      const root =
        graphData.nodes.find((n) => !n.parents || n.parents.length === 0) || graphData.nodes[0];
      const hierarchy = d3
        .stratify<GraphNode>()
        .id((d) => d.id)
        .parentId((d) => {
          if (d.parents && d.parents.length > 0) return d.parents[0];
          return d.id === root.id ? null : root.id;
        })(graphData.nodes);

      const treeLayout = d3.tree<GraphNode>().size([width - 100, height - 100]);
      const treeData = treeLayout(hierarchy as any);

      treeData.descendants().forEach((node: any) => {
        const dataNode = graphData.nodes.find((n) => n.id === node.data.id);
        if (dataNode) {
          (dataNode as any).x = node.x + 50;
          (dataNode as any).y = node.y + 50;
          (dataNode as any).fx = (dataNode as any).x;
          (dataNode as any).fy = (dataNode as any).y;
        }
      });

      simulation = d3
        .forceSimulation<GraphNode>(graphData.nodes)
        .force(
          "link",
          d3
            .forceLink<GraphNode, GraphLink>(validLinks)
            .id((d) => d.id)
            .distance(50),
        )
        .alpha(0.1)
        .alphaDecay(0.05);
    } else if (layout === "circular") {
      // Circular layout - all nodes in a circle
      const radius = Math.min(width, height) / 2 - 50;
      graphData.nodes.forEach((node, i) => {
        const angle = (i / graphData.nodes.length) * 2 * Math.PI;
        (node as any).x = width / 2 + radius * Math.cos(angle);
        (node as any).y = height / 2 + radius * Math.sin(angle);
        (node as any).fx = (node as any).x;
        (node as any).fy = (node as any).y;
      });

      simulation = d3
        .forceSimulation<GraphNode>(graphData.nodes)
        .force(
          "link",
          d3
            .forceLink<GraphNode, GraphLink>(validLinks)
            .id((d) => d.id)
            .distance(100),
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
    const node = container
      .append("g")
      .selectAll("g")
      .data(graphData.nodes)
      .join("g")
      .call(
        d3
          .drag<SVGGElement, GraphNode>()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended) as any,
      );

    // Node circles
    node
      .append("circle")
      .attr("r", (d) => d.size || 8)
      .attr("fill", (d) => getNodeColor(d.group, d.facet))
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .on("mouseover", function (event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("r", (d.size || 8) * 1.5);
        setSelectedNode(d);
      })
      .on("mouseout", function (event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("r", d.size || 8);
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
      .attr("font-size", 12)
      .attr("fill", "#333")
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
    function dragstarted(event: any, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: GraphNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: GraphNode) {
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
  }, [graphData, width, height, layout, onNodeClick]);

  // Filter nodes based on search
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const nodes = svg.selectAll("g g");

    nodes.each(function (d: any) {
      const node = d3.select(this);
      const matches =
        searchTerm === "" ||
        d.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.description?.toLowerCase().includes(searchTerm.toLowerCase());

      const groupMatches =
        !highlightGroup || d.group === highlightGroup || d.facet === highlightGroup;

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
      <div className="flex flex-wrap gap-4 items-center bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        <div className="flex gap-2 items-center">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Layout:</label>
          <select
            value={layout}
            onChange={(e) => setLayout(e.target.value as LayoutType)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="force">Force-Directed</option>
            <option value="radial">Radial</option>
            <option value="tree">Tree</option>
            <option value="circular">Circular</option>
          </select>
        </div>

        <div className="flex gap-2 items-center">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter:</label>
          <select
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
            onClick={() => {
              setSearchTerm("");
              setHighlightGroup(null);
            }}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors text-gray-900 dark:text-white"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Graph and Info Panel */}
      <div className="flex gap-4">
        {/* SVG Graph */}
        <div className="flex-1 border rounded-lg bg-white shadow-sm overflow-hidden">
          <svg
            ref={svgRef}
            width={width}
            height={height}
            className="cursor-move"
            onClick={() => setSelectedNode(null)}
          />
        </div>

        {/* Info Panel */}
        {selectedNode && (
          <div className="w-80 border rounded-lg bg-white shadow-lg p-6 space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-xl font-bold text-gray-900">{selectedNode.label}</h3>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-gray-400 hover:text-gray-600"
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

// Helper functions
function processTopicsData(topics: any[]): { nodes: GraphNode[]; links: GraphLink[] } {
  if (!topics || topics.length === 0) {
    return { nodes: [], links: [] };
  }

  const nodes: GraphNode[] = topics.map((t) => ({
    id: t.id,
    label: t.label || t.id,
    group: t.facet_group || "other",
    facet: t.facet,
    description: t.description,
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

function processFeedsData(feeds: any[]): { nodes: GraphNode[]; links: GraphLink[] } {
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

    const topics = feed.topics || feed.tags || [];
    const topicsArray = Array.isArray(topics)
      ? topics
      : typeof topics === "string"
        ? topics.split(",").map((t: string) => t.trim())
        : [];

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

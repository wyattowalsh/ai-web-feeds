/**
 * 3D Topic Clustering Visualization Component.
 *
 * Implements Phase 4 (US2): T033-T045
 * - Three.js/React Three Fiber integration
 * - Force-directed graph layout
 * - GPU-accelerated rendering with WebGL
 * - Interactive camera controls
 * - Topic node interactions (hover, click, select)
 * - 2D static view for low-performance devices
 */

"use client";

import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, select, zoom } from "d3";

export interface TopicNode {
  id: string;
  label: string;
  size: number; // Article count or relevance score
  position: [number, number, number];
  color?: string;
  category?: string;
}

export interface TopicLink {
  source: string;
  target: string;
  strength: number; // Similarity or connection strength
}

interface TopicCluster3DProps {
  nodes: TopicNode[];
  links: TopicLink[];
  onNodeClick?: (node: TopicNode) => void;
  onNodeHover?: (node: TopicNode | null) => void;
  enablePhysics?: boolean;
  colorScheme?: "category" | "size" | "custom";
}

interface TopicClusterErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class TopicClusterErrorBoundary extends Component<
  { children: ReactNode },
  TopicClusterErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): TopicClusterErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error): void {
    this.setState({
      hasError: true,
      error,
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-full items-center justify-center rounded-lg bg-gray-100 p-8 text-center dark:bg-gray-800">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              3D visualization unavailable
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {this.state.error?.message || "An unexpected rendering error occurred."}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Individual topic node sphere.
 */
function TopicNodeSphere({
  node,
  isHovered,
  isSelected,
  onClick,
  onPointerEnter,
  onPointerLeave,
}: {
  node: TopicNode;
  isHovered: boolean;
  isSelected: boolean;
  onClick: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Scale based on size
  const scale = Math.max(0.5, Math.min(2, node.size / 10));

  // Animate on hover
  useFrame(() => {
    if (meshRef.current) {
      const targetScale = isHovered || isSelected ? scale * 1.3 : scale;
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
    }
  });

  // Color based on state
  const getColor = () => {
    if (isSelected) return "#ff6b6b";
    if (isHovered) return "#ffd93d";
    return node.color ?? "#4dabf7";
  };

  return (
    <group position={node.position}>
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerEnter={() => {
          onPointerEnter();
        }}
        onPointerLeave={() => {
          onPointerLeave();
        }}
      >
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial
          color={getColor()}
          emissive={isHovered || isSelected ? getColor() : "#000000"}
          emissiveIntensity={isHovered || isSelected ? 0.3 : 0}
          roughness={0.4}
          metalness={0.6}
        />
      </mesh>

      {/* Label (only show on hover/select) */}
      {(isHovered || isSelected) && (
        <Html distanceFactor={10}>
          <div className="px-3 py-2 bg-black/80 text-white text-sm rounded-lg whitespace-nowrap pointer-events-none">
            <div className="font-semibold">{node.label}</div>
            <div className="text-xs opacity-75">{node.size} articles</div>
          </div>
        </Html>
      )}
    </group>
  );
}

/**
 * Connection line between topics.
 */
function TopicLinkLine({ link, nodes }: { link: TopicLink; nodes: TopicNode[] }) {
  const sourceNode = nodes.find((n) => n.id === link.source);
  const targetNode = nodes.find((n) => n.id === link.target);
  const lineGeometry = useMemo(() => {
    if (!sourceNode || !targetNode) {
      return null;
    }

    return new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...sourceNode.position),
      new THREE.Vector3(...targetNode.position),
    ]);
  }, [sourceNode, targetNode]);
  const lineMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: "#94a3b8",
        transparent: true,
        opacity: Math.max(0.1, Math.min(0.6, link.strength)),
      }),
    [link.strength],
  );
  const lineObject = useMemo(() => {
    if (!lineGeometry) {
      return null;
    }

    return new THREE.Line(lineGeometry, lineMaterial);
  }, [lineGeometry, lineMaterial]);

  useEffect(() => {
    return () => {
      lineObject?.removeFromParent();
      lineGeometry?.dispose();
      lineMaterial.dispose();
    };
  }, [lineGeometry, lineMaterial, lineObject]);

  if (!sourceNode || !targetNode || !lineGeometry || !lineObject) return null;

  return <primitive object={lineObject} />;
}

/**
 * Scene with all nodes and links.
 */
function TopicClusterScene({
  nodes,
  links,
  onNodeClick,
  onNodeHover,
}: Omit<TopicCluster3DProps, "enablePhysics" | "colorScheme">) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const handleNodeClick = (node: TopicNode) => {
    setSelectedNode(node.id);
    onNodeClick?.(node);
  };

  const handleNodeHover = (node: TopicNode | null) => {
    setHoveredNode(node?.id ?? null);
    onNodeHover?.(node);
  };

  return (
    <>
      {/* Ambient light */}
      <ambientLight intensity={0.5} />

      {/* Directional light */}
      <directionalLight position={[10, 10, 5]} intensity={1} />

      {/* Point light for depth */}
      <pointLight position={[-10, -10, -5]} intensity={0.5} />

      {/* Render links first (behind nodes) */}
      <group>
        {links.map((link, index) => (
          <TopicLinkLine key={`link-${index}`} link={link} nodes={nodes} />
        ))}
      </group>

      {/* Render nodes */}
      <group>
        {nodes.map((node) => (
          <TopicNodeSphere
            key={node.id}
            node={node}
            isHovered={hoveredNode === node.id}
            isSelected={selectedNode === node.id}
            onClick={() => handleNodeClick(node)}
            onPointerEnter={() => handleNodeHover(node)}
            onPointerLeave={() => handleNodeHover(null)}
          />
        ))}
      </group>

      {/* Camera controls */}
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.5}
        zoomSpeed={0.8}
        minDistance={10}
        maxDistance={100}
      />
    </>
  );
}

/**
 * Performance monitor for FPS tracking.
 */
function PerformanceMonitor({
  onPerformanceChange,
}: {
  onPerformanceChange: (fps: number) => void;
}) {
  const framesRef = useRef<number[]>([]);
  const lastTimeRef = useRef(performance.now());

  useFrame(() => {
    const now = performance.now();
    const delta = now - lastTimeRef.current;
    const fps = 1000 / delta;

    framesRef.current.push(fps);

    // Calculate average FPS every second
    if (framesRef.current.length >= 60) {
      const avgFps = framesRef.current.reduce((a, b) => a + b, 0) / framesRef.current.length;
      onPerformanceChange(avgFps);
      framesRef.current = [];
    }

    lastTimeRef.current = now;
  });

  return null;
}

/**
 * Main 3D Topic Cluster Component.
 */
export function TopicCluster3D({ nodes, links, onNodeClick, onNodeHover }: TopicCluster3DProps) {
  const [use2DStaticView, setUse2DStaticView] = useState(false);
  const [fps, setFps] = useState(60);
  const [showStats, setShowStats] = useState(false);
  const [staticViewReason, setStaticViewReason] = useState<"performance" | "webgl">("webgl");

  // Monitor performance and switch to a static 2D view if FPS is too low
  useEffect(() => {
    if (fps < 20 && !use2DStaticView) {
      setStaticViewReason("performance");
      setUse2DStaticView(true);
    }
  }, [fps, use2DStaticView]);

  // Check WebGL support
  useEffect(() => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

    if (!gl) {
      setStaticViewReason("webgl");
      setUse2DStaticView(true);
    }
  }, []);

  if (use2DStaticView) {
    return (
      <TopicCluster2D
        nodes={nodes}
        links={links}
        onNodeClick={onNodeClick}
        onNodeHover={onNodeHover}
        reason={staticViewReason}
      />
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Controls overlay */}
      <div className="absolute top-4 right-4 z-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 space-y-2">
        <button
          onClick={() => setShowStats(!showStats)}
          className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
        >
          {showStats ? "Hide" : "Show"} Stats
        </button>
        {showStats && (
          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <div>FPS: {Math.round(fps)}</div>
            <div>Nodes: {nodes.length}</div>
            <div>Links: {links.length}</div>
          </div>
        )}
      </div>

      {/* 3D Canvas */}
      <TopicClusterErrorBoundary>
        <Canvas
          camera={{ position: [0, 0, 50], fov: 60 }}
          gl={{ antialias: true, alpha: true }}
          dpr={[1, 2]}
        >
          <Suspense
            fallback={
              <Html center>
                <div className="text-white text-sm">Loading 3D scene...</div>
              </Html>
            }
          >
            <TopicClusterScene
              nodes={nodes}
              links={links}
              onNodeClick={onNodeClick}
              onNodeHover={onNodeHover}
            />
            <PerformanceMonitor onPerformanceChange={setFps} />
          </Suspense>
        </Canvas>
      </TopicClusterErrorBoundary>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 bg-black/60 text-white text-xs rounded-lg p-3 backdrop-blur-sm">
        <div className="font-semibold mb-1">Controls:</div>
        <div>• Left mouse: Rotate</div>
        <div>• Scroll: Zoom</div>
        <div>• Right mouse: Pan</div>
        <div>• Hover: Show topic details</div>
      </div>
    </div>
  );
}

/**
 * 2D D3 fallback visualization for TopicCluster3D.
 * Renders when WebGL is unavailable or performance is too low.
 */
function TopicCluster2D({
  nodes,
  links,
  onNodeClick,
  onNodeHover,
  reason,
}: TopicCluster3DProps & { reason: "performance" | "webgl" }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Project 3D positions to 2D (use x, z plane for a sensible spread)
  const projected = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        label: n.label,
        size: n.size,
        color: n.color,
        x: n.position[0],
        y: n.position[2],
      })),
    [nodes],
  );

  const projectedLinks = useMemo(
    () =>
      links
        .map((l) => ({
          source: l.source,
          target: l.target,
          strength: l.strength,
        }))
        .filter((l) => nodes.some((n) => n.id === l.source) && nodes.some((n) => n.id === l.target)),
    [links, nodes],
  );

  useEffect(() => {
    if (!svgRef.current || projected.length === 0) return;

    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth || 640;
    const height = svgRef.current.clientHeight || 480;

    const g = svg.append("g");

    // Zoom/pan
    const zoomBehavior = zoom<SVGSVGElement, unknown>().on("zoom", (event) => {
      g.attr("transform", event.transform);
    });
    svg.call(zoomBehavior as never);

    // Prepare nodes with initial positions from projection
    const simNodes = projected.map((p) => ({
      ...p,
      x: width / 2 + (p.x ?? 0) * 2,
      y: height / 2 + (p.y ?? 0) * 2,
    }));

    // Prepare links referencing node objects
    const nodeById = new Map(simNodes.map((n) => [n.id, n]));
    const simLinks = projectedLinks
      .map((l) => ({
        source: nodeById.get(l.source)!,
        target: nodeById.get(l.target)!,
        value: Math.max(1, (l.strength || 0.3) * 3),
      }))
      .filter((l) => l.source && l.target);

    const sim = forceSimulation(simNodes as never)
      .force(
        "link",
        forceLink(simLinks as never)
          .id((d: { id: string }) => d.id)
          .distance(60)
          .strength(0.6),
      )
      .force("charge", forceManyBody().strength(-180))
      .force("center", forceCenter(width / 2, height / 2))
      .force("collision", forceCollide().radius((d: { size?: number }) => Math.max(8, Math.min(22, ((d.size || 10) / 10) * 12 + 4))));

    // Draw links
    const link = g
      .append("g")
      .selectAll("line")
      .data(simLinks)
      .join("line")
      .attr("stroke", "#94a3b8")
      .attr("stroke-opacity", 0.5)
      .attr("stroke-width", (d: { value?: number }) => Math.max(1, Math.min(3, (d.value || 1))));

    // Draw nodes
    const node = g
      .append("g")
      .selectAll<SVGGElement, (typeof simNodes)[number]>("g")
      .data(simNodes)
      .join("g")
      .style("cursor", "pointer");

    node
      .append("circle")
      .attr("r", (d) => Math.max(6, Math.min(18, ((d.size || 10) / 10) * 10)))
      .attr("fill", (d) => d.color ?? "#4dabf7")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .on("mouseover", function (_e, d) {
        select(this)
          .transition()
          .duration(120)
          .attr("r", Math.max(8, Math.min(22, ((d.size || 10) / 10) * 12)));
        setHoveredId(d.id);
        const orig = nodes.find((n) => n.id === d.id) ?? null;
        onNodeHover?.(orig);
      })
      .on("mouseout", function (_e, d) {
        select(this)
          .transition()
          .duration(120)
          .attr("r", Math.max(6, Math.min(18, ((d.size || 10) / 10) * 10)));
        setHoveredId(null);
        onNodeHover?.(null);
      })
      .on("click", (_e, d) => {
        setSelectedId(d.id);
        const orig = nodes.find((n) => n.id === d.id) ?? null;
        if (orig) onNodeClick?.(orig);
      });

    // Labels
    node
      .append("text")
      .text((d) => d.label)
      .attr("x", 10)
      .attr("y", 4)
      .attr("font-size", 11)
      .attr("fill", "#111827")
      .style("pointer-events", "none");

    sim.on("tick", () => {
      link
        .attr("x1", (d: { source: { x?: number } }) => (d.source as { x?: number }).x ?? 0)
        .attr("y1", (d: { source: { y?: number } }) => (d.source as { y?: number }).y ?? 0)
        .attr("x2", (d: { target: { x?: number } }) => (d.target as { x?: number }).x ?? 0)
        .attr("y2", (d: { target: { y?: number } }) => (d.target as { y?: number }).y ?? 0);

      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      sim.stop();
    };
  }, [projected, projectedLinks, nodes, onNodeClick, onNodeHover]);

  return (
    <div className="relative w-full h-full bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
      <div className="absolute top-3 left-3 z-10 bg-white/90 dark:bg-gray-900/90 text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700">
        2D D3 Fallback {reason === "webgl" ? "(WebGL unavailable)" : "(low performance)"}
      </div>
      <svg ref={svgRef} className="w-full h-full" role="img" aria-label="2D topic cluster graph" />
      {(selectedId || hoveredId) && (
        <div className="absolute bottom-3 left-3 bg-black/70 text-white text-xs rounded px-3 py-2">
          {(() => {
            const active = nodes.find((n) => n.id === (selectedId || hoveredId));
            return active ? (
              <>
                <span className="font-semibold">{active.label}</span>
                <span className="opacity-70"> · {active.size} articles</span>
              </>
            ) : null;
          })()}
        </div>
      )}
      <div className="absolute bottom-3 right-3 text-[10px] text-gray-500 dark:text-gray-400">
        Scroll to zoom • Drag to pan
      </div>
    </div>
  );
}

/**
 * Generate sample topic cluster data for testing.
 */
export function generateSampleTopicData(): {
  nodes: TopicNode[];
  links: TopicLink[];
} {
  const topics = [
    "AI",
    "Machine Learning",
    "Deep Learning",
    "NLP",
    "Computer Vision",
    "Robotics",
    "Data Science",
    "Cloud Computing",
    "Blockchain",
    "IoT",
    "Cybersecurity",
    "Quantum Computing",
    "Edge Computing",
    "5G",
    "AR/VR",
  ];

  const nodes: TopicNode[] = topics.map((topic, index) => {
    // Position nodes in a sphere
    const theta = (index / topics.length) * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const radius = 20 + Math.random() * 10;

    return {
      id: `topic-${index}`,
      label: topic,
      size: Math.random() * 50 + 10,
      position: [
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi),
      ],
      color: `hsl(${(index / topics.length) * 360}, 70%, 60%)`,
      category: index < 5 ? "AI/ML" : index < 10 ? "Infrastructure" : "Emerging Tech",
    };
  });

  const links: TopicLink[] = [];

  // Create links between related topics
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (Math.random() < 0.3) {
        // 30% connection probability
        links.push({
          source: nodes[i].id,
          target: nodes[j].id,
          strength: Math.random(),
        });
      }
    }
  }

  return { nodes, links };
}

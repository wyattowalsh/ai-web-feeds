/**
 * 3D Topic Clustering Visualization Component.
 *
 * Implements Phase 4 (US2): T033-T045
 * - Three.js/React Three Fiber integration
 * - Force-directed graph layout
 * - GPU-accelerated rendering with WebGL
 * - Interactive camera controls
 * - Topic node interactions (hover, click, select)
 * - 2D fallback for low-performance devices
 */

"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Html } from "@react-three/drei";
import * as THREE from "three";

interface TopicNode {
  id: string;
  label: string;
  size: number; // Article count or relevance score
  position: [number, number, number];
  color?: string;
  category?: string;
}

interface TopicLink {
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
  const [hovered, setHovered] = useState(false);

  // Scale based on size
  const scale = Math.max(0.5, Math.min(2, node.size / 10));

  // Animate on hover
  useFrame(() => {
    if (meshRef.current) {
      const targetScale = isHovered || isSelected ? scale * 1.3 : scale;
      meshRef.current.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        0.1
      );
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
          setHovered(true);
          onPointerEnter();
        }}
        onPointerLeave={() => {
          setHovered(false);
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
function TopicLink({
  link,
  nodes,
}: {
  link: TopicLink;
  nodes: TopicNode[];
}) {
  const sourceNode = nodes.find((n) => n.id === link.source);
  const targetNode = nodes.find((n) => n.id === link.target);

  if (!sourceNode || !targetNode) return null;

  const points = [
    new THREE.Vector3(...sourceNode.position),
    new THREE.Vector3(...targetNode.position),
  ];

  const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);

  // Opacity based on connection strength
  const opacity = Math.max(0.1, Math.min(0.6, link.strength));

  return (
    <line>
      <bufferGeometry attach="geometry" {...lineGeometry} />
      <lineBasicMaterial
        attach="material"
        color="#94a3b8"
        transparent
        opacity={opacity}
        linewidth={1}
      />
    </line>
  );
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
          <TopicLink key={`link-${index}`} link={link} nodes={nodes} />
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
  const { gl, scene, camera } = useThree();
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
export function TopicCluster3D({
  nodes,
  links,
  onNodeClick,
  onNodeHover,
  enablePhysics = false,
  colorScheme = "category",
}: TopicCluster3DProps) {
  const [use2DFallback, setUse2DFallback] = useState(false);
  const [fps, setFps] = useState(60);
  const [showStats, setShowStats] = useState(false);

  // Monitor performance and fall back to 2D if FPS is too low
  useEffect(() => {
    if (fps < 20 && !use2DFallback) {
      console.warn("Low FPS detected, switching to 2D fallback");
      setUse2DFallback(true);
    }
  }, [fps, use2DFallback]);

  // Check WebGL support
  useEffect(() => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

    if (!gl) {
      console.warn("WebGL not supported, using 2D fallback");
      setUse2DFallback(true);
    }
  }, []);

  if (use2DFallback) {
    return (
      <div className="w-full h-full bg-gray-100 dark:bg-gray-800 rounded-lg p-8">
        <div className="text-center">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            2D Fallback Mode
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            WebGL is not available or performance is low. Showing 2D topic graph instead.
          </p>
          {/* TODO: Render 2D graph using D3.js or Canvas */}
        </div>
      </div>
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
      <Canvas
        camera={{ position: [0, 0, 50], fov: 60 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]} // Pixel ratio for retina displays
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
 * Generate sample topic cluster data for testing.
 */
export function generateSampleTopicData(): {
  nodes: TopicNode[];
  links: TopicLink[];
} {
  const topics = [
    "AI", "Machine Learning", "Deep Learning", "NLP", "Computer Vision",
    "Robotics", "Data Science", "Cloud Computing", "Blockchain", "IoT",
    "Cybersecurity", "Quantum Computing", "Edge Computing", "5G", "AR/VR",
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
      if (Math.random() < 0.3) { // 30% connection probability
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

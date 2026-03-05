/**
 * Animation system for 3D visualizations.
 *
 * Implements T044: Smooth transitions and effects
 */

"use client";

import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { animated, useSpring } from "@react-spring/three";

interface AnimatedNodeProps {
  position: [number, number, number];
  targetPosition: [number, number, number];
  scale: number;
  targetScale: number;
  color: string;
  targetColor: string;
  animationDuration?: number;
  onAnimationComplete?: () => void;
}

/**
 * Animated node with smooth transitions.
 */
export function AnimatedNode({
  position,
  targetPosition,
  scale,
  targetScale,
  color,
  targetColor,
  animationDuration = 1000,
  onAnimationComplete,
}: AnimatedNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Spring animation for position
  const { pos } = useSpring({
    pos: targetPosition,
    from: { pos: position },
    config: { mass: 1, tension: 170, friction: 26 },
    onRest: onAnimationComplete,
  });

  // Spring animation for scale
  const { scl } = useSpring({
    scl: targetScale,
    from: { scl: scale },
    config: { mass: 1, tension: 170, friction: 26 },
  });

  return (
    <animated.mesh ref={meshRef} position={pos as any} scale={scl}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial color={color} />
    </animated.mesh>
  );
}

/**
 * Pulsing animation effect.
 */
export function PulsingNode({
  position,
  baseScale = 1,
  pulseAmplitude = 0.2,
  pulseSpeed = 2,
  color = "#4dabf7",
}: {
  position: [number, number, number];
  baseScale?: number;
  pulseAmplitude?: number;
  pulseSpeed?: number;
  color?: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const scale = baseScale + Math.sin(clock.getElapsedTime() * pulseSpeed) * pulseAmplitude;
      meshRef.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.3}
      />
    </mesh>
  );
}

/**
 * Rotating animation for groups.
 */
export function RotatingGroup({
  children,
  rotationSpeed = 0.5,
  axis = "y",
}: {
  children: React.ReactNode;
  rotationSpeed?: number;
  axis?: "x" | "y" | "z";
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation[axis] += rotationSpeed * 0.01;
    }
  });

  return <group ref={groupRef}>{children}</group>;
}

/**
 * Fade in/out animation.
 */
export function FadingNode({
  position,
  scale = 1,
  color = "#4dabf7",
  fadeIn = true,
  duration = 1000,
  onComplete,
}: {
  position: [number, number, number];
  scale?: number;
  color?: string;
  fadeIn?: boolean;
  duration?: number;
  onComplete?: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  const { opacity } = useSpring({
    opacity: fadeIn ? 1 : 0,
    from: { opacity: fadeIn ? 0 : 1 },
    config: { duration },
    onRest: onComplete,
  });

  return (
    <animated.mesh ref={meshRef} position={position} scale={scale}>
      <sphereGeometry args={[1, 32, 32]} />
      <animated.meshStandardMaterial
        color={color}
        transparent
        opacity={opacity}
      />
    </animated.mesh>
  );
}

/**
 * Animated connection line between nodes.
 */
export function AnimatedLink({
  start,
  end,
  color = "#94a3b8",
  animationProgress = 1,
}: {
  start: [number, number, number];
  end: [number, number, number];
  color?: string;
  animationProgress?: number;
}) {
  const animatedEnd: [number, number, number] = [
    start[0] + (end[0] - start[0]) * animationProgress,
    start[1] + (end[1] - start[1]) * animationProgress,
    start[2] + (end[2] - start[2]) * animationProgress,
  ];

  const points = [
    new THREE.Vector3(...start),
    new THREE.Vector3(...animatedEnd),
  ];

  const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);

  return (
    <line>
      <bufferGeometry attach="geometry" {...lineGeometry} />
      <lineBasicMaterial attach="material" color={color} linewidth={2} />
    </line>
  );
}

/**
 * Camera animation controller.
 */
export function CameraAnimator({
  targetPosition,
  targetLookAt,
  duration = 2000,
  onComplete,
}: {
  targetPosition: [number, number, number];
  targetLookAt: [number, number, number];
  duration?: number;
  onComplete?: () => void;
}) {
  const { position } = useSpring({
    position: targetPosition,
    config: { duration },
    onRest: onComplete,
  });

  const { lookAt } = useSpring({
    lookAt: targetLookAt,
    config: { duration },
  });

  // This would be used with camera controls
  // Implementation depends on the camera setup

  return null;
}

/**
 * Particle effect system.
 */
export function ParticleEffect({
  position,
  count = 50,
  spread = 5,
  speed = 1,
  color = "#4dabf7",
}: {
  position: [number, number, number];
  count?: number;
  spread?: number;
  speed?: number;
  color?: string;
}) {
  const particlesRef = useRef<THREE.Points>(null);

  useFrame(({ clock }) => {
    if (particlesRef.current) {
      const positions = particlesRef.current.geometry.attributes.position
        .array as Float32Array;

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        positions[i3 + 1] += speed * 0.01; // Move up

        // Reset particle if it goes too high
        if (positions[i3 + 1] > position[1] + spread) {
          positions[i3 + 1] = position[1];
        }
      }

      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  // Generate particle positions
  const particlePositions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    particlePositions[i * 3] = position[0] + (Math.random() - 0.5) * spread;
    particlePositions[i * 3 + 1] = position[1] + Math.random() * spread;
    particlePositions[i * 3 + 2] = position[2] + (Math.random() - 0.5) * spread;
  }

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[particlePositions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial size={0.1} color={color} transparent opacity={0.6} />
    </points>
  );
}

/**
 * Animation presets for common scenarios.
 */
export const AnimationPresets = {
  /**
   * Node appears with scale-in effect.
   */
  scaleIn: {
    from: { scale: 0, opacity: 0 },
    to: { scale: 1, opacity: 1 },
    config: { mass: 1, tension: 280, friction: 60 },
  },

  /**
   * Node disappears with scale-out effect.
   */
  scaleOut: {
    from: { scale: 1, opacity: 1 },
    to: { scale: 0, opacity: 0 },
    config: { mass: 1, tension: 280, friction: 60 },
  },

  /**
   * Smooth position transition.
   */
  smooth: {
    config: { mass: 1, tension: 170, friction: 26 },
  },

  /**
   * Bouncy effect.
   */
  bouncy: {
    config: { mass: 1, tension: 280, friction: 12 },
  },

  /**
   * Slow and steady.
   */
  slow: {
    config: { mass: 5, tension: 170, friction: 26 },
  },

  /**
   * Quick snap.
   */
  quick: {
    config: { mass: 1, tension: 500, friction: 40 },
  },
};

/**
 * Sequence multiple animations.
 */
export class AnimationSequence {
  private animations: Array<{
    execute: () => Promise<void>;
    delay?: number;
  }> = [];

  add(execute: () => Promise<void>, delay = 0) {
    this.animations.push({ execute, delay });
    return this;
  }

  async play() {
    for (const animation of this.animations) {
      if (animation.delay) {
        await new Promise((resolve) => setTimeout(resolve, animation.delay));
      }
      await animation.execute();
    }
  }
}

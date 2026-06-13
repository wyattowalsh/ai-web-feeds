import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const frameCallbacks: Array<() => void> = [];
let shouldThrowCanvas = false;

vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: { children: ReactNode }) => {
    if (shouldThrowCanvas) {
      throw new Error("Canvas exploded");
    }

    return <div data-testid="mock-canvas">{children}</div>;
  },
  useFrame: (callback: () => void) => {
    if (callback.toString().includes("performance.now")) {
      frameCallbacks.push(callback);
    }
  },
}));

vi.mock("@react-three/drei", () => ({
  Html: ({ children }: { children: ReactNode }) => <div data-testid="html-overlay">{children}</div>,
  OrbitControls: () => <div data-testid="orbit-controls" />,
}));

import { TopicCluster3D } from "./TopicCluster3D";

const sampleNodes = [
  {
    id: "topic-a",
    label: "Alpha",
    size: 12,
    position: [0, 0, 0] as [number, number, number],
    color: "#f97316",
  },
  {
    id: "topic-b",
    label: "Beta",
    size: 8,
    position: [2, 1, -1] as [number, number, number],
    color: "#3b82f6",
  },
];

const sampleLinks = [
  {
    source: "topic-a",
    target: "topic-b",
    strength: 0.4,
  },
];

function createMockCanvasContext(
  ...args: Parameters<HTMLCanvasElement["getContext"]>
): ReturnType<HTMLCanvasElement["getContext"]> {
  void args;
  return {} as never;
}

describe("TopicCluster3D", () => {
  beforeEach(() => {
    frameCallbacks.length = 0;
    shouldThrowCanvas = false;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(createMockCanvasContext);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the 2D static view when WebGL is unavailable", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

    render(<TopicCluster3D nodes={sampleNodes} links={sampleLinks} />);

    expect(await screen.findByText("2D Static View")).toBeInTheDocument();
    expect(
      screen.getByText(
        "WebGL is not available in this browser, so a static 2D view is being used.",
      ),
    ).toBeInTheDocument();
  });

  it("shows stats for the live 3D view and switches to static 2D on low performance", async () => {
    let currentTime = 0;
    vi.spyOn(performance, "now").mockImplementation(() => {
      currentTime += 100;
      return currentTime;
    });

    render(<TopicCluster3D nodes={sampleNodes} links={sampleLinks} />);

    fireEvent.click(screen.getByRole("button", { name: "Show Stats" }));
    expect(screen.getByText("FPS: 60")).toBeInTheDocument();
    expect(screen.getByText("Nodes: 2")).toBeInTheDocument();
    expect(screen.getByText("Links: 1")).toBeInTheDocument();
    expect(screen.getByTestId("mock-canvas")).toBeInTheDocument();
    expect(screen.getByText("Controls:")).toBeInTheDocument();

    await act(async () => {
      for (let index = 0; index < 60; index += 1) {
        frameCallbacks.forEach((callback) => callback());
      }
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          "Rendering performance is too low for the 3D graph, so a static 2D view is being used.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("renders the error boundary when the canvas throws", () => {
    shouldThrowCanvas = true;

    render(<TopicCluster3D nodes={sampleNodes} links={sampleLinks} />);

    expect(screen.getByText("3D visualization unavailable")).toBeInTheDocument();
    expect(screen.getByText("Canvas exploded")).toBeInTheDocument();
  });

  it("disposes link resources during cleanup", () => {
    const geometryDisposeSpy = vi.spyOn(THREE.BufferGeometry.prototype, "dispose");
    const materialDisposeSpy = vi.spyOn(THREE.Material.prototype, "dispose");
    const removeFromParentSpy = vi.spyOn(THREE.Object3D.prototype, "removeFromParent");

    const { unmount } = render(<TopicCluster3D nodes={sampleNodes} links={sampleLinks} />);

    unmount();

    expect(removeFromParentSpy).toHaveBeenCalled();
    expect(geometryDisposeSpy).toHaveBeenCalled();
    expect(materialDisposeSpy).toHaveBeenCalled();
  });
});

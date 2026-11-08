import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createVisualization,
  deleteVisualization,
  getVisualization,
  getVisualizationData,
  listVisualizations,
  updateVisualization,
  visualizationApi,
} from "@/lib/visualization/api-client";

const STORAGE_KEY = "aiwebfeeds_visualizations";

function createLocalStorageMock() {
  const store = new Map<string, string>();

  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  };
}

describe("visualization api client", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let localStorageMock: ReturnType<typeof createLocalStorageMock>;

  beforeEach(() => {
    fetchMock = vi.fn();
    localStorageMock = createLocalStorageMock();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", { localStorage: localStorageMock });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns exactly an empty non-demo series for a saved visualization", async () => {
    const saved = await createVisualization({
      device_id: "device-a",
      name: "Topic volume",
      chart_type: "line",
      data_source: "topics",
      filters: {
        date_range: { start: "2026-01-01", end: "2026-01-31" },
        date_preset: "30d",
      },
    });

    await expect(getVisualizationData(saved.id)).resolves.toEqual({
      demo: false,
      points: [],
    });
    await expect(getVisualizationData(saved.id, "device-a")).resolves.toEqual({
      demo: false,
      points: [],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not synthesize points for any saved chart type", async () => {
    for (const chartType of ["bar", "line", "area", "pie", "scatter", "heatmap"]) {
      const saved = await createVisualization({
        device_id: "device-a",
        name: chartType,
        chart_type: chartType,
        data_source: "feeds",
      });

      await expect(visualizationApi.getData(saved.id, "device-a")).resolves.toEqual({
        demo: false,
        points: [],
      });
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws when the visualization id is unknown", async () => {
    await expect(getVisualizationData("missing")).rejects.toThrow("Visualization not found");
    await expect(getVisualization("missing")).rejects.toThrow("Visualization not found");
    await expect(updateVisualization("missing", { name: "Nope" })).rejects.toThrow(
      "Visualization not found",
    );
    await expect(deleteVisualization("missing")).rejects.toThrow("Visualization not found");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("filters stored records by device_id without sending it as a credential", async () => {
    const owned = await visualizationApi.create({
      device_id: "device-a",
      name: "Owned",
      chart_type: "bar",
      data_source: "articles",
    });
    await visualizationApi.create({
      device_id: "device-b",
      name: "Other",
      chart_type: "pie",
      data_source: "articles",
    });

    const listed = await listVisualizations("device-a");

    expect(listed.map((item) => item.id)).toEqual([owned.id]);
    expect(listed[0]?.device_id).toBe("device-a");
    await expect(getVisualization(owned.id, "device-b")).rejects.toThrow(
      "Visualization does not belong to this device",
    );
    await expect(getVisualizationData(owned.id, "device-b")).rejects.toThrow(
      "Visualization does not belong to this device",
    );
    await expect(updateVisualization(owned.id, { name: "Stolen" }, "device-b")).rejects.toThrow(
      "Visualization does not belong to this device",
    );
    await expect(deleteVisualization(owned.id, "device-b")).rejects.toThrow(
      "Visualization does not belong to this device",
    );
    await expect(getVisualizationData(owned.id, "device-a")).resolves.toEqual({
      demo: false,
      points: [],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("updates and deletes a saved visualization without adding points", async () => {
    const created = await createVisualization({
      device_id: "device-a",
      name: "Before",
      chart_type: "line",
      data_source: "topics",
      customization: { showLegend: true, legendPosition: "bottom" },
    });

    expect(created.customization).toMatchObject({
      show_legend: true,
      legend_position: "bottom",
    });

    const loaded = await getVisualization(created.id, "device-a");
    expect(loaded.id).toBe(created.id);
    expect(loaded.name).toBe("Before");

    const updated = await updateVisualization(
      created.id,
      { name: "After", chart_type: "area", customization: { showLegend: false } },
      "device-a",
    );

    expect(updated.name).toBe("After");
    expect(updated.chart_type).toBe("area");
    expect(updated.device_id).toBe("device-a");
    expect(updated.customization).toMatchObject({ show_legend: false });
    await expect(getVisualizationData(updated.id)).resolves.toEqual({
      demo: false,
      points: [],
    });

    await deleteVisualization(updated.id, "device-a");
    await expect(listVisualizations("device-a")).resolves.toEqual([]);
    await expect(getVisualizationData(updated.id)).rejects.toThrow("Visualization not found");
  });

  it("lists visualizations newest update first", async () => {
    localStorageMock.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: "viz_older",
          device_id: "device-a",
          name: "Older",
          chart_type: "line",
          data_source: "topics",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
          last_viewed: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "viz_newer",
          device_id: "device-a",
          name: "Newer",
          chart_type: "bar",
          data_source: "topics",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-02-01T00:00:00.000Z",
          last_viewed: "2026-01-01T00:00:00.000Z",
        },
      ]),
    );

    const listed = await listVisualizations();
    expect(listed.map((item) => item.id)).toEqual(["viz_newer", "viz_older"]);
  });

  it("ignores unreadable visualization storage", async () => {
    localStorageMock.setItem(STORAGE_KEY, "{");
    await expect(listVisualizations()).resolves.toEqual([]);

    localStorageMock.setItem(STORAGE_KEY, JSON.stringify({ id: "not-a-list" }));
    await expect(listVisualizations()).resolves.toEqual([]);

    localStorageMock.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: "incomplete" },
        {
          id: "viz_ok",
          device_id: "device-a",
          name: "Kept",
          chart_type: "line",
          data_source: "topics",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-02T00:00:00.000Z",
          last_viewed: "2026-01-02T00:00:00.000Z",
        },
      ]),
    );

    const listed = await listVisualizations();
    expect(listed.map((item) => item.id)).toEqual(["viz_ok"]);
    await expect(getVisualizationData("viz_ok", "device-a")).resolves.toEqual({
      demo: false,
      points: [],
    });
  });

  it("keeps the visualizationApi method names", () => {
    expect(visualizationApi.list).toBe(listVisualizations);
    expect(visualizationApi.create).toBe(createVisualization);
    expect(visualizationApi.get).toBe(getVisualization);
    expect(visualizationApi.update).toBe(updateVisualization);
    expect(visualizationApi.delete).toBe(deleteVisualization);
    expect(visualizationApi.getData).toBe(getVisualizationData);
  });

  it("does not fabricate sample series in source", () => {
    const source = readFileSync(join(process.cwd(), "lib/visualization/api-client.ts"), "utf8");

    expect(source).not.toContain("getDeviceId");
    expect(source).not.toContain("Math.random");
    expect(source).not.toContain("createSampleValues");
    expect(source).not.toContain("Authorization");
    expect(source).toContain("demo: false");
    expect(source).toContain("points: []");
  });
});

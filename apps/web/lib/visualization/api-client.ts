const VISUALIZATION_STORAGE_KEY = "aiwebfeeds_visualizations";

export interface Visualization {
  id: string;
  device_id: string;
  name: string;
  chart_type: string;
  data_source: string;
  filters: {
    date_range?: {
      start: string;
      end: string;
    };
    date_preset?: string;
    [key: string]: unknown;
  };
  customization: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  last_viewed: string;
}

export interface CreateVisualizationInput {
  device_id: string;
  name: string;
  chart_type: string;
  data_source: string;
  filters?: Visualization["filters"];
  customization?: object;
}

export type UpdateVisualizationInput = Partial<
  Pick<Visualization, "name" | "chart_type" | "data_source" | "filters">
> & {
  customization?: object;
};

let memoryVisualizations: Visualization[] = [];

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readVisualizations(): Visualization[] {
  const storage = getStorage();
  if (!storage) {
    return [...memoryVisualizations];
  }

  try {
    const raw = storage.getItem(VISUALIZATION_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is Visualization => {
      if (!item || typeof item !== "object") {
        return false;
      }

      const record = item as Record<string, unknown>;
      return (
        typeof record.id === "string" &&
        typeof record.device_id === "string" &&
        typeof record.name === "string" &&
        typeof record.chart_type === "string" &&
        typeof record.data_source === "string" &&
        typeof record.created_at === "string" &&
        typeof record.updated_at === "string" &&
        typeof record.last_viewed === "string"
      );
    });
  } catch {
    return [];
  }
}

function writeVisualizations(visualizations: Visualization[]): void {
  memoryVisualizations = [...visualizations];

  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(VISUALIZATION_STORAGE_KEY, JSON.stringify(visualizations));
  } catch {
    // Ignore storage quota or serialization issues.
  }
}

function ensureVisualization(
  id: string,
  deviceId?: string,
  updateLastViewed: boolean = false
): Visualization {
  const visualizations = readVisualizations();
  const index = visualizations.findIndex((item) => item.id === id);
  if (index < 0) {
    throw new Error("Visualization not found");
  }

  const current = visualizations[index];
  if (deviceId && current.device_id !== deviceId) {
    throw new Error("Visualization does not belong to this device");
  }

  if (!updateLastViewed) {
    return current;
  }

  const updated: Visualization = {
    ...current,
    last_viewed: new Date().toISOString(),
  };
  visualizations[index] = updated;
  writeVisualizations(visualizations);
  return updated;
}

function normalizeCustomization(customization?: object): Record<string, unknown> {
  const next = { ...((customization ?? {}) as Record<string, unknown>) };

  if (next.showLegend !== undefined && next.show_legend === undefined) {
    next.show_legend = next.showLegend;
  }

  if (next.legendPosition !== undefined && next.legend_position === undefined) {
    next.legend_position = next.legendPosition;
  }

  return next;
}

export async function createVisualization(
  input: CreateVisualizationInput
): Promise<Visualization> {
  const now = new Date().toISOString();
  const visualizations = readVisualizations();

  const visualization: Visualization = {
    id: `viz_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    device_id: input.device_id,
    name: input.name,
    chart_type: input.chart_type,
    data_source: input.data_source,
    filters: input.filters ?? {},
    customization: normalizeCustomization(input.customization),
    created_at: now,
    updated_at: now,
    last_viewed: now,
  };

  visualizations.unshift(visualization);
  writeVisualizations(visualizations);
  return visualization;
}

export async function getVisualization(id: string, deviceId?: string): Promise<Visualization> {
  return ensureVisualization(id, deviceId, true);
}

export async function updateVisualization(
  id: string,
  updates: UpdateVisualizationInput,
  deviceId?: string
): Promise<Visualization> {
  const visualizations = readVisualizations();
  const index = visualizations.findIndex((item) => item.id === id);
  if (index < 0) {
    throw new Error("Visualization not found");
  }

  const current = visualizations[index];
  if (deviceId && current.device_id !== deviceId) {
    throw new Error("Visualization does not belong to this device");
  }

  const updated: Visualization = {
    ...current,
    ...updates,
    customization:
      updates.customization !== undefined
        ? normalizeCustomization(updates.customization)
        : current.customization,
    updated_at: new Date().toISOString(),
  };

  visualizations[index] = updated;
  writeVisualizations(visualizations);
  return updated;
}

export async function deleteVisualization(id: string, deviceId?: string): Promise<void> {
  const visualizations = readVisualizations();
  const target = visualizations.find((item) => item.id === id);
  if (!target) {
    throw new Error("Visualization not found");
  }

  if (deviceId && target.device_id !== deviceId) {
    throw new Error("Visualization does not belong to this device");
  }

  writeVisualizations(visualizations.filter((item) => item.id !== id));
}

function createSampleValues(seed: string, length: number): number[] {
  let value = seed
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);

  return Array.from({ length }, () => {
    value = (value * 9301 + 49297) % 233280;
    return Math.round((value / 233280) * 100);
  });
}

function createDateLabels(range?: { start: string; end: string }): string[] {
  if (!range?.start || !range?.end) {
    return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  }

  const start = new Date(range.start);
  const end = new Date(range.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  }

  const labels: string[] = [];
  const current = new Date(start);
  while (current <= end && labels.length < 12) {
    labels.push(current.toLocaleDateString());
    current.setDate(current.getDate() + Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 6))));
  }

  return labels.length > 0 ? labels : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
}

export async function getVisualizationData(
  id: string,
  deviceId?: string
): Promise<unknown> {
  const visualization = ensureVisualization(id, deviceId);
  const labels = createDateLabels(visualization.filters.date_range);
  const values = createSampleValues(visualization.id, labels.length);

  switch (visualization.chart_type) {
    case "scatter":
      return {
        datasets: [
          {
            label: visualization.data_source,
            data: values.map((value, index) => ({
              x: index + 1,
              y: value,
            })),
            backgroundColor: "rgba(59, 130, 246, 0.6)",
            borderColor: "rgb(59, 130, 246)",
          },
        ],
      };
    case "pie":
      return {
        labels: ["Healthy", "Moderate", "Unhealthy"],
        datasets: [
          {
            data: [values[0] ?? 40, values[1] ?? 35, values[2] ?? 25],
            backgroundColor: ["#10b981", "#f59e0b", "#ef4444"],
            borderColor: ["#059669", "#d97706", "#dc2626"],
            borderWidth: 1,
          },
        ],
      };
    case "heatmap": {
      const xLabels = labels;
      const yLabels = ["Week 1", "Week 2", "Week 3"];
      const data = yLabels.flatMap((rowLabel, rowIndex) =>
        xLabels.map((columnLabel, columnIndex) => ({
          x: columnLabel,
          y: rowLabel,
          v: (values[(rowIndex + columnIndex) % values.length] ?? 0) + rowIndex * 5,
        }))
      );

      return {
        data,
        xLabels,
        yLabels,
      };
    }
    case "bar":
      return {
        labels,
        datasets: [
          {
            label: visualization.data_source,
            data: values,
            backgroundColor: "rgba(59, 130, 246, 0.6)",
            borderColor: "rgb(59, 130, 246)",
            borderWidth: 1,
          },
        ],
      };
    case "area":
    case "line":
    default:
      return {
        labels,
        datasets: [
          {
            label: visualization.data_source,
            data: values,
            borderColor: "rgb(59, 130, 246)",
            backgroundColor: "rgba(59, 130, 246, 0.2)",
            borderWidth: 2,
            fill: visualization.chart_type === "area",
            tension: 0.3,
          },
        ],
      };
  }
}

export async function listVisualizations(deviceId?: string): Promise<Visualization[]> {
  const visualizations = readVisualizations();
  const filtered = deviceId
    ? visualizations.filter((item) => item.device_id === deviceId)
    : visualizations;

  return filtered.sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

export const visualizationApi = {
  list: listVisualizations,
  create: createVisualization,
  get: getVisualization,
  update: updateVisualization,
  delete: deleteVisualization,
  getData: getVisualizationData,
};

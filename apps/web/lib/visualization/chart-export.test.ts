import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { exportChart } from "./chart-export";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "chart-export.ts"),
  "utf8",
);

const EXPORTED_AT = "2026-11-08T15:04:05.000Z";

type MarkedCanvas = HTMLCanvasElement & { pixels?: string };

type Download = {
  filename: string;
  blob: Blob;
};

type DrawnExport = {
  width: number;
  height: number;
  transform: number[];
  source: CanvasImageSource | null;
};

const downloads: Download[] = [];
let pendingBlob: Blob | null = null;
let drawn: DrawnExport | null = null;
let fetchSpy: ReturnType<typeof vi.spyOn> | undefined;
let randomSpy: ReturnType<typeof vi.spyOn> | undefined;

function catalogCanvas(width: number, height: number, pixels: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  (canvas as MarkedCanvas).pixels = pixels;
  return canvas;
}

function dataUrlFor(canvas: HTMLCanvasElement): string {
  return `data:image/png;base64,${(canvas as MarkedCanvas).pixels ?? ""}`;
}

async function written(index = 0): Promise<Download & { body: string }> {
  const item = downloads[index];
  if (!item) {
    throw new Error(`expected chart download ${index}`);
  }

  return { ...item, body: await item.blob.text() };
}

function unescapeHtml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function expectWroteGivenChartOnly(): void {
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(randomSpy).not.toHaveBeenCalled();
  expect(document.querySelector("a[download]")).toBeNull();
}

describe("exportChart", () => {
  beforeEach(() => {
    downloads.length = 0;
    pendingBlob = null;
    drawn = null;

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(EXPORTED_AT));

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("exportChart must not fetch");
    });
    randomSpy = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("exportChart must not call Math.random");
    });

    vi.spyOn(URL, "createObjectURL").mockImplementation((value) => {
      pendingBlob = value as Blob;
      return `blob:chart-${downloads.length}`;
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLElement.prototype, "click").mockImplementation(function mockClick(
      this: HTMLElement,
    ) {
      if (!(this instanceof HTMLAnchorElement) || !pendingBlob) {
        return;
      }

      downloads.push({ filename: this.download, blob: pendingBlob });
    });

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function mockGetContext(
      this: HTMLCanvasElement,
    ) {
      return {
        setTransform: (...transform: number[]) => {
          drawn = {
            width: this.width,
            height: this.height,
            transform,
            source: drawn?.source ?? null,
          };
        },
        drawImage: (image: CanvasImageSource) => {
          drawn = {
            width: drawn?.width ?? this.width,
            height: drawn?.height ?? this.height,
            transform: drawn?.transform ?? [],
            source: image,
          };
        },
      } as unknown as CanvasRenderingContext2D;
    });

    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function mockToBlob(
      this: HTMLCanvasElement,
      callback: BlobCallback,
    ) {
      const sourceCanvas = drawn?.source;
      if (!(sourceCanvas instanceof HTMLCanvasElement)) {
        callback(null);
        return;
      }

      const pixels = (sourceCanvas as MarkedCanvas).pixels;
      if (!pixels) {
        callback(null);
        return;
      }

      callback(
        new Blob([`png:${sourceCanvas.width}x${sourceCanvas.height}:${pixels}`], {
          type: "image/png",
        }),
      );
    });

    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(function mockToDataUrl(
      this: HTMLCanvasElement,
      type?: string,
    ) {
      const pixels = (this as MarkedCanvas).pixels;
      if (type !== "image/png" || !pixels) {
        throw new Error("exportChart read a canvas it was not given");
      }

      return dataUrlFor(this);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("writes the given canvas to a png download without inventing a series", async () => {
    const canvas = catalogCanvas(640, 360, "catalog-row-pixels");
    const config = {
      dataSource: "catalog",
      chartType: "bar",
      dateRange: { start: "2026-01-01", end: "2026-01-31" },
    };

    await exportChart(canvas, config, { format: "png", dpi: 72, title: "Agents Weekly" });

    const file = await written();
    expect(file.filename).toBe("agents-weekly.png");
    expect(file.blob.type).toBe("image/png");
    expect(file.body).toBe("png:640x360:catalog-row-pixels");
    expect(file.body).not.toContain("forecast");
    expect(file.body).not.toContain("demo");
    expect(drawn).toEqual({
      width: 640,
      height: 360,
      transform: [1, 0, 0, 1, 0, 0],
      source: canvas,
    });
    expect(HTMLCanvasElement.prototype.toDataURL).not.toHaveBeenCalled();
    expect(config).toEqual({
      dataSource: "catalog",
      chartType: "bar",
      dateRange: { start: "2026-01-01", end: "2026-01-31" },
    });
    expectWroteGivenChartOnly();
  });

  it("scales the given canvas for the requested dpi and keeps each export separate", async () => {
    const first = catalogCanvas(72, 36, "row-a");
    const second = catalogCanvas(20, 10, "row-b");

    await exportChart(
      first,
      { dataSource: "catalog" },
      { format: "png", dpi: 300, title: "Row A" },
    );
    expect(drawn?.source).toBe(first);
    expect(drawn?.width).toBe(300);
    expect(drawn?.height).toBe(150);
    expect(drawn?.transform).toEqual([300 / 72, 0, 0, 300 / 72, 0, 0]);

    await exportChart(
      second,
      { dataSource: "catalog" },
      { format: "png", dpi: 150, title: "Row B" },
    );

    const firstFile = await written(0);
    const secondFile = await written(1);
    expect(firstFile.body).toBe("png:72x36:row-a");
    expect(secondFile.body).toBe("png:20x10:row-b");
    expect(downloads.map((item) => item.filename)).toEqual(["row-a.png", "row-b.png"]);
    expect(drawn?.source).toBe(second);
    expect(drawn?.width).toBe(42);
    expect(drawn?.height).toBe(21);
    expectWroteGivenChartOnly();
  });

  it("embeds the given canvas data url in svg and nothing else", async () => {
    const canvas = catalogCanvas(320, 180, "catalog-svg-pixels");
    const image = dataUrlFor(canvas);

    await exportChart(canvas, { dataSource: "catalog", chartType: "line" }, { format: "svg" });

    const file = await written();
    expect(file.filename).toBe("visualization-2026-11-08.svg");
    expect(file.blob.type).toBe("image/svg+xml");
    expect(file.body).toBe(
      [
        `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">`,
        `<image href="${image}" width="320" height="180" />`,
        "</svg>",
      ].join(""),
    );
    expect(file.body).not.toContain("forecast");
    expect(file.body).not.toContain("demo");
    expect(file.body.match(/<image /g)).toHaveLength(1);
    expect(drawn).toBeNull();
    expectWroteGivenChartOnly();
  });

  it("writes an html snapshot of the given canvas and leaves metadata off by default", async () => {
    const canvas = catalogCanvas(32, 16, "row-html-pixels");

    await exportChart(canvas, { dataSource: "catalog", chartType: "bar" }, { format: "html" });

    const file = await written();
    expect(file.filename).toBe("visualization-2026-11-08.html");
    expect(file.blob.type).toBe("text/html");
    expect(file.body).toContain("<h1>Visualization Export</h1>");
    expect(file.body).toContain(`<img src="${dataUrlFor(canvas)}" alt="Visualization Export" />`);
    expect(file.body.match(/<img /g)).toHaveLength(1);
    expect(file.body).not.toContain("Metadata");
    expect(file.body).not.toContain("exportedAt");
    expect(file.body).not.toContain("dataSource");
    expect(file.body).not.toContain("chartType");
    expect(file.body).not.toContain("forecast");
    expect(file.body).not.toContain("demo");
    expect(file.body).not.toContain("fetch(");
    expectWroteGivenChartOnly();
  });

  it("escapes the title and writes only the given config when metadata is requested", async () => {
    const canvas = catalogCanvas(48, 24, "catalog-meta-pixels");
    const config = {
      dataSource: "catalog",
      chartType: "bar",
      dateRange: { start: "2026-01-01", end: "2026-01-02" },
      datePreset: "custom",
      customization: { sourceId: "src-agents", note: 'Tom\'s <row> & "count"' },
    };
    const title = 'Tom\'s <Agents> & "Notes"';

    await exportChart(
      canvas,
      config,
      { format: "html", includeMetadata: true, title },
      "not-a-jwt",
    );

    const file = await written();
    expect(file.filename).toBe("tom-s-agents-notes.html");
    expect(file.body).toContain("<h1>Tom&#39;s &lt;Agents&gt; &amp; &quot;Notes&quot;</h1>");
    expect(file.body).toContain(
      `<img src="${dataUrlFor(canvas)}" alt="Tom&#39;s &lt;Agents&gt; &amp; &quot;Notes&quot;" />`,
    );
    expect(file.body).not.toContain("<Agents>");
    expect(file.body).not.toContain("<script");

    const pre = file.body.match(/<pre>([\s\S]*)<\/pre>/);
    expect(pre?.[1]).toBeDefined();
    const metadata = JSON.parse(unescapeHtml(pre?.[1] ?? "")) as {
      exportedAt: string;
      deviceId: string;
      config: typeof config;
    };

    expect(Object.keys(metadata).sort()).toEqual(["config", "deviceId", "exportedAt"]);
    expect(metadata).toEqual({
      exportedAt: EXPORTED_AT,
      deviceId: "not-a-jwt",
      config,
    });
    expect(metadata).not.toHaveProperty("demo");
    expect(metadata).not.toHaveProperty("points");
    expect(metadata).not.toHaveProperty("forecast");
    expect(metadata).not.toHaveProperty("forecasts");
    expect(file.body).not.toContain("eyJ");
    expect(config.customization.note).toBe('Tom\'s <row> & "count"');
    expectWroteGivenChartOnly();
  });

  it("records a null device id when metadata is on and no device id was given", async () => {
    const canvas = catalogCanvas(8, 8, "catalog-device-pixels");
    const config = { dataSource: "catalog", chartType: "bar" };

    await exportChart(canvas, config, {
      format: "html",
      includeMetadata: true,
      title: "Catalog",
    });

    const file = await written();
    const pre = file.body.match(/<pre>([\s\S]*)<\/pre>/);
    const metadata = JSON.parse(unescapeHtml(pre?.[1] ?? "")) as {
      deviceId: string | null;
      config: typeof config;
    };

    expect(metadata.deviceId).toBeNull();
    expect(metadata.config).toEqual(config);
    expect(file.body).not.toContain("forecast");
    expect(file.body).not.toMatch(/demo"\s*:\s*true/);
    expectWroteGivenChartOnly();
  });

  it("rejects a png export when the canvas context or blob is unavailable", async () => {
    const canvas = catalogCanvas(16, 16, "catalog-row-pixels");
    const config = { dataSource: "catalog" };

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    await expect(
      exportChart(canvas, config, { format: "png", title: "Agents Weekly" }),
    ).rejects.toThrow("Unable to prepare canvas export");
    expect(downloads).toHaveLength(0);

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function mockGetContext(
      this: HTMLCanvasElement,
    ) {
      drawn = {
        width: this.width,
        height: this.height,
        transform: [],
        source: canvas,
      };
      return { setTransform: () => {}, drawImage: () => {} } as unknown as CanvasRenderingContext2D;
    });
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback: BlobCallback) => {
      callback(null);
    });

    await expect(
      exportChart(canvas, config, { format: "png", title: "Agents Weekly" }),
    ).rejects.toThrow("Failed to create image export");
    expect(downloads).toHaveLength(0);
    expectWroteGivenChartOnly();
  });

  it("refuses to export outside the browser", async () => {
    const canvas = catalogCanvas(16, 16, "row-reject-pixels");
    vi.stubGlobal("window", undefined);

    await expect(
      exportChart(canvas, { dataSource: "catalog" }, { format: "png", title: "Agents Weekly" }),
    ).rejects.toThrow("Chart export is only available in the browser");

    vi.unstubAllGlobals();
    expect(downloads).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(randomSpy).not.toHaveBeenCalled();
    expect(document.querySelector("a[download]")).toBeNull();
  });

  it("does not fetch, invent a series, or import another chart stack", () => {
    const exportedFunctions = [...source.matchAll(/export (?:async )?function (\w+)/g)].map(
      (match) => match[1],
    );

    expect(exportedFunctions).toEqual(["exportChart"]);
    expect(source).not.toMatch(/\bfrom\s+["']/);
    expect(source).not.toMatch(/\bimport\s*\(/);
    expect(source).not.toMatch(/\brequire\s*\(/);
    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/from ["']three["']/);
    expect(source).not.toMatch(/from ["']chart\.js["']/);
    expect(source).not.toMatch(/from ["']d3["']/);
    expect(source).not.toMatch(/ChartBuilder/);
    expect(source).not.toMatch(/device-id/);
    expect(source).not.toMatch(/jsonwebtoken|jwt\.sign|createDeviceId/);
    expect(source).not.toMatch(/demo:\s*true/);
    expect(source).not.toMatch(/generateSampleData/);
    expect(source).not.toMatch(/forecast/i);
  });
});

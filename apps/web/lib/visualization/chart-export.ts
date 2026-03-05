export type ExportFormat = "png" | "svg" | "html";

interface ChartConfig {
  dataSource?: string;
  chartType?: string;
  dateRange?: {
    start?: string;
    end?: string;
  };
  datePreset?: string;
  customization?: Record<string, unknown>;
}

interface ExportOptions {
  format: ExportFormat;
  dpi?: 72 | 150 | 300;
  includeMetadata?: boolean;
  title?: string;
}

function sanitizeFilename(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function defaultFilename(format: ExportFormat, title?: string): string {
  const base =
    sanitizeFilename(title ?? "") || `visualization-${new Date().toISOString().slice(0, 10)}`;
  return `${base}.${format}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function canvasToBlob(canvas: HTMLCanvasElement, dpi: 72 | 150 | 300): Promise<Blob> {
  const scale = dpi / 72;
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = Math.max(1, Math.round(canvas.width * scale));
  exportCanvas.height = Math.max(1, Math.round(canvas.height * scale));

  const ctx = exportCanvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to prepare canvas export");
  }

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.drawImage(canvas, 0, 0);

  return await new Promise<Blob>((resolve, reject) => {
    exportCanvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Failed to create image export"));
      }
    }, "image/png");
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportChart(
  canvas: HTMLCanvasElement,
  config: ChartConfig,
  options: ExportOptions,
  deviceId?: string
): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Chart export is only available in the browser");
  }

  const format = options.format;
  const filename = defaultFilename(format, options.title);

  if (format === "png") {
    const blob = await canvasToBlob(canvas, options.dpi ?? 72);
    downloadBlob(blob, filename);
    return;
  }

  const imageDataUrl = canvas.toDataURL("image/png");

  if (format === "svg") {
    const svg = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">`,
      `<image href="${imageDataUrl}" width="${canvas.width}" height="${canvas.height}" />`,
      "</svg>",
    ].join("");

    downloadBlob(new Blob([svg], { type: "image/svg+xml" }), filename);
    return;
  }

  const metadata = options.includeMetadata
    ? JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          deviceId: deviceId ?? null,
          config,
        },
        null,
        2
      )
    : null;

  const html = [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "  <meta charset=\"UTF-8\" />",
    "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />",
    `  <title>${escapeHtml(options.title ?? "Visualization Export")}</title>`,
    "  <style>body{font-family:system-ui,-apple-system,sans-serif;margin:24px;color:#111827}img{max-width:100%;height:auto;border:1px solid #e5e7eb;border-radius:8px}pre{background:#f3f4f6;padding:12px;border-radius:8px;overflow:auto}</style>",
    "</head>",
    "<body>",
    `  <h1>${escapeHtml(options.title ?? "Visualization Export")}</h1>`,
    `  <img src="${imageDataUrl}" alt="${escapeHtml(options.title ?? "Chart export")}" />`,
  ];

  if (metadata) {
    html.push("  <h2>Metadata</h2>");
    html.push(`  <pre>${escapeHtml(metadata)}</pre>`);
  }

  html.push("</body>", "</html>");
  downloadBlob(new Blob([html.join("\n")], { type: "text/html" }), filename);
}

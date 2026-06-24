import {
  articles,
  feeds,
  folders,
  preferences,
  type Article,
  type Feed,
  type Folder,
} from "@/lib/db";
import { loadCustomViews } from "@/lib/organization/custom-view-schema";

export type ExportBundle = {
  version: 1;
  exportedAt: string;
  articles: Article[];
  feeds: Feed[];
  folders: Folder[];
  preferences: Awaited<ReturnType<typeof preferences.get>>;
  customViews: ReturnType<typeof loadCustomViews>;
};

export async function buildExportBundle(): Promise<ExportBundle> {
  const [articleRows, feedRows, folderRows, prefs] = await Promise.all([
    articles.getAll(),
    feeds.getAll(),
    folders.getAll(),
    preferences.get(),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    articles: articleRows,
    feeds: feedRows,
    folders: folderRows,
    preferences: prefs,
    customViews: loadCustomViews(),
  };
}

export async function exportJson(): Promise<string> {
  const bundle = await buildExportBundle();
  return JSON.stringify(bundle, null, 2);
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function exportArticlesCsv(): Promise<string> {
  const rows = await articles.getAll();
  const header = ["id", "title", "link", "feedId", "read", "starred", "pubDate"].join(",");
  const body = rows
    .map((row) =>
      [row.id, row.title, row.link, row.feedId, row.read, row.starred, row.pubDate]
        .map((cell) => escapeCsv(String(cell)))
        .join(","),
    )
    .join("\n");
  return `${header}\n${body}`;
}

export async function exportOpml(): Promise<string> {
  const feedRows = await feeds.getAll();
  const body = feedRows
    .map(
      (feed) =>
        `    <outline type="rss" text="${escapeXml(feed.title)}" xmlUrl="${escapeXml(
          feed.url,
        )}" />`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <body>\n${body}\n  </body>\n</opml>`;
}

export async function exportHtml(): Promise<string> {
  const rows = await articles.getAll();
  const items = rows
    .map(
      (row) =>
        `<article><h2><a href="${escapeXml(row.link)}">${escapeXml(
          row.title,
        )}</a></h2><p>${escapeXml(row.summary ?? "")}</p></article>`,
    )
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><title>AI Web Feeds Export</title></head><body>${items}</body></html>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function downloadText(filename: string, content: string, mime = "text/plain"): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

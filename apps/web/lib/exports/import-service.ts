import { articles, feeds, folders, preferences, type Feed, type Folder } from "@/lib/db";
import { saveCustomViews, type CustomView } from "@/lib/organization/custom-view-schema";
import type { ExportBundle } from "@/lib/exports/export-service";

export type ImportResult = {
  articles: number;
  feeds: number;
  folders: number;
  customViews: number;
  errors: string[];
};

export function parseImportJson(raw: string): ExportBundle {
  const parsed = JSON.parse(raw) as ExportBundle;
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.articles)) {
    throw new Error("Unsupported export format");
  }
  return parsed;
}

export async function importBundle(bundle: ExportBundle): Promise<ImportResult> {
  const errors: string[] = [];
  let articleCount = 0;
  let feedCount = 0;
  let folderCount = 0;
  let viewCount = 0;

  try {
    if (bundle.articles?.length) {
      await articles.bulkPut(bundle.articles);
      articleCount = bundle.articles.length;
    }
  } catch (error) {
    errors.push(`articles: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    for (const feed of bundle.feeds ?? []) {
      await feeds.put(feed as Feed);
      feedCount += 1;
    }
  } catch (error) {
    errors.push(`feeds: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    for (const folder of bundle.folders ?? []) {
      await folders.put(folder as Folder);
      folderCount += 1;
    }
  } catch (error) {
    errors.push(`folders: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    if (bundle.preferences) {
      await preferences.put(bundle.preferences);
    }
  } catch (error) {
    errors.push(`preferences: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    if (bundle.customViews?.length) {
      saveCustomViews(bundle.customViews as CustomView[]);
      viewCount = bundle.customViews.length;
    }
  } catch (error) {
    errors.push(`customViews: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    articles: articleCount,
    feeds: feedCount,
    folders: folderCount,
    customViews: viewCount,
    errors,
  };
}

export type ReadStatusFilter = "all" | "unread" | "read";

export interface CustomViewFilters {
  feedIds?: string[];
  topics?: string[];
  tags?: string[];
  dateRange?: { from?: string; to?: string };
  readStatus?: ReadStatusFilter;
  starred?: boolean;
  priority?: Array<"low" | "normal" | "high">;
  searchQuery?: string;
  folderIds?: string[];
}

export interface CustomView {
  id: string;
  name: string;
  description?: string;
  filters: CustomViewFilters;
  layout: "list" | "cards" | "compact";
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "aiwebfeeds.customViews";

export function validateCustomViewFilters(filters: CustomViewFilters): string[] {
  const errors: string[] = [];
  if (filters.searchQuery && filters.searchQuery.length > 200) {
    errors.push("searchQuery must be 200 characters or fewer");
  }
  if (filters.readStatus && !["all", "unread", "read"].includes(filters.readStatus)) {
    errors.push("readStatus must be all, unread, or read");
  }
  return errors;
}

export function loadCustomViews(): CustomView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomView[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomViews(views: CustomView[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
}

export function upsertCustomView(view: CustomView): CustomView[] {
  const views = loadCustomViews();
  const index = views.findIndex((v) => v.id === view.id);
  if (index >= 0) views[index] = view;
  else views.push(view);
  saveCustomViews(views);
  return views;
}

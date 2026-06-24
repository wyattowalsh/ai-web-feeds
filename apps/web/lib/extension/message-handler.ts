/**
 * Web app bridge for browser extension messages.
 */

export type ExtensionMessageType = "SAVE_ARTICLE" | "SUBSCRIBE_FEED" | "PING";

export interface ExtensionMessage {
  type: ExtensionMessageType;
  payload?: Record<string, unknown>;
  source?: "ai-web-feeds-extension";
}

export interface ExtensionQueueItem {
  id: string;
  type: ExtensionMessageType;
  payload: Record<string, unknown>;
  receivedAt: number;
  status: "queued" | "applied" | "failed";
}

const QUEUE_KEY = "aiwebfeeds.extensionQueue";

export function parseExtensionMessage(data: unknown): ExtensionMessage | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const type = record.type;
  if (type !== "SAVE_ARTICLE" && type !== "SUBSCRIBE_FEED" && type !== "PING") return null;
  return {
    type,
    payload: (record.payload as Record<string, unknown> | undefined) ?? {},
    source: record.source === "ai-web-feeds-extension" ? "ai-web-feeds-extension" : undefined,
  };
}

export function clearExtensionQueue(): void {
  saveExtensionQueue([]);
}

export function loadExtensionQueue(): ExtensionQueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ExtensionQueueItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveExtensionQueue(items: ExtensionQueueItem[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export function enqueueExtensionMessage(message: ExtensionMessage): ExtensionQueueItem {
  const item: ExtensionQueueItem = {
    id: `ext_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: message.type,
    payload: message.payload ?? {},
    receivedAt: Date.now(),
    status: "queued",
  };
  const queue = loadExtensionQueue();
  queue.unshift(item);
  saveExtensionQueue(queue.slice(0, 200));
  return item;
}

export function handleExtensionMessage(data: unknown): ExtensionQueueItem | null {
  const message = parseExtensionMessage(data);
  if (!message) return null;
  if (message.type === "PING") {
    return enqueueExtensionMessage(message);
  }
  return enqueueExtensionMessage(message);
}

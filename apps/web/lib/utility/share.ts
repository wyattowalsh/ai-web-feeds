/**
 * Share utilities
 *
 * Provides helpers for sharing content via the Web Share API
 * with graceful fallbacks to clipboard copy.
 */

export type SharePayload = {
  title?: string;
  text?: string;
  url: string;
};

export type ShareResult = {
  method: "share" | "clipboard";
  success: boolean;
  error?: string;
};

/**
 * Check if the Web Share API is available and can share the given payload.
 */
export function canUseWebShare(payload?: SharePayload): boolean {
  if (typeof navigator === "undefined" || !navigator.share) {
    return false;
  }

  // navigator.canShare is optional but recommended when available
  if (typeof navigator.canShare === "function" && payload) {
    try {
      // Build a minimal ShareData object; url is required for our payloads
      const data: ShareData = {};
      if (payload.title) data.title = payload.title;
      if (payload.text) data.text = payload.text;
      data.url = payload.url;
      return navigator.canShare(data);
    } catch {
      // If canShare throws, fall back to presence check only
      return true;
    }
  }

  return true;
}

/**
 * Attempt to share a URL (and optional metadata) using navigator.share.
 * Falls back to copying the URL to the clipboard if share is unavailable or fails.
 */
export async function shareUrl(payload: SharePayload): Promise<ShareResult> {
  const { title, text, url } = payload;

  // Prefer Web Share API when available
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      const data: ShareData = { url };
      if (title) data.title = title;
      if (text) data.text = text;

      // Some browsers require canShare to pass before calling share
      if (typeof navigator.canShare === "function") {
        try {
          if (!navigator.canShare(data)) {
            // Fall through to clipboard if canShare says no
            return await copyToClipboard(url);
          }
        } catch {
          // Ignore canShare errors and attempt share anyway
        }
      }

      await navigator.share(data);
      return { method: "share", success: true };
    } catch (error) {
      // AbortError (user cancelled) should not surface as failure for callers
      if (error instanceof DOMException && error.name === "AbortError") {
        return { method: "share", success: false, error: "cancelled" };
      }
      // Fall back to clipboard on any other share error
      return await copyToClipboard(url);
    }
  }

  // No share API — copy to clipboard
  return await copyToClipboard(url);
}

async function copyToClipboard(url: string): Promise<ShareResult> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return {
      method: "clipboard",
      success: false,
      error: "Clipboard API unavailable",
    };
  }

  try {
    await navigator.clipboard.writeText(url);
    return { method: "clipboard", success: true };
  } catch (error) {
    return {
      method: "clipboard",
      success: false,
      error: error instanceof Error ? error.message : "Failed to copy to clipboard",
    };
  }
}

/**
 * Convenience helper that only copies the URL (never attempts native share).
 */
export async function copyUrl(url: string): Promise<ShareResult> {
  return copyToClipboard(url);
}

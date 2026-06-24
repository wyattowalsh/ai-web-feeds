import { describe, expect, it } from "vitest";

import {
  clearExtensionQueue,
  handleExtensionMessage,
  loadExtensionQueue,
  parseExtensionMessage,
} from "@/lib/extension/message-handler";

describe("extension message handler", () => {
  it("parses save article messages", () => {
    const message = parseExtensionMessage({
      type: "SAVE_ARTICLE",
      payload: { url: "https://example.com/post" },
      source: "ai-web-feeds-extension",
    });
    expect(message?.type).toBe("SAVE_ARTICLE");
  });

  it("rejects unknown message types", () => {
    expect(parseExtensionMessage({ type: "UNKNOWN" })).toBeNull();
  });

  it("enqueues valid messages", () => {
    clearExtensionQueue();
    const item = handleExtensionMessage({
      type: "SUBSCRIBE_FEED",
      payload: { feedUrl: "https://example.com/feed.xml" },
      source: "ai-web-feeds-extension",
    });
    expect(item?.status).toBe("queued");
    expect(loadExtensionQueue()).toHaveLength(1);
  });
});

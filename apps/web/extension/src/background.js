const QUEUE_KEY = "aiwebfeeds.extensionQueue";

async function queueMessage(message) {
  const existing = (await chrome.storage.local.get(QUEUE_KEY))[QUEUE_KEY];
  const queue = Array.isArray(existing) ? existing : [];
  queue.unshift({
    id: `ext_${Date.now()}`,
    type: message.type,
    payload: message.payload,
    receivedAt: Date.now(),
    status: "queued",
  });
  await chrome.storage.local.set({ [QUEUE_KEY]: queue.slice(0, 200) });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-article",
    title: "Save to AI Web Feeds",
    contexts: ["page", "link"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const url = info.linkUrl || info.pageUrl || tab?.url;
  if (!url) return;
  void queueMessage({
    type: "SAVE_ARTICLE",
    payload: { url, title: tab?.title ?? url },
    source: "ai-web-feeds-extension",
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "PING") {
    sendResponse({ ok: true });
    return true;
  }
  return false;
});

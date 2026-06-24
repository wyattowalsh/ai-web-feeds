// lib/search/tokenize.ts
function tokenizeQuery(query) {
  const q = (query || "").trim();
  if (!q) return [];
  const terms = [];
  const re = /"([^"]+)"|'([^']+)'|(\S+)/g;
  for (const m of q.matchAll(re)) {
    const t = (m[1] || m[2] || m[3] || "").trim().toLowerCase();
    if (t) terms.push(t);
  }
  return terms;
}
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// workers/search.worker.ts
var articles = [];
function scoreArticle(article, terms) {
  const title = (article.title || "").toLowerCase();
  const content = (article.content || "").toLowerCase();
  const summary = (article.summary || "").toLowerCase();
  const author = (article.author || "").toLowerCase();
  const topics = (article.topics || []).map((t) => t.toLowerCase()).join(" ");
  const tags = (article.tags || []).map((t) => t.toLowerCase()).join(" ");
  let score = 0;
  const matched = /* @__PURE__ */ new Set();
  for (const term of terms) {
    let termScore = 0;
    if (title.includes(term)) {
      termScore += 8;
      matched.add("title");
    }
    if (summary.includes(term)) {
      termScore += 4;
      matched.add("summary");
    }
    if (content.includes(term)) {
      termScore += 2;
      matched.add("content");
    }
    if (author.includes(term)) {
      termScore += 3;
      matched.add("author");
    }
    if (topics.includes(term)) {
      termScore += 2;
      matched.add("topics");
    }
    if (tags.includes(term)) {
      termScore += 2;
      matched.add("tags");
    }
    if (title === term) termScore += 6;
    const wordRe = new RegExp(`\\b${escapeRegExp(term)}\\b`);
    if (wordRe.test(title)) termScore += 3;
    score += termScore;
  }
  const ageDays = (Date.now() - (article.pubDate || 0)) / (1e3 * 60 * 60 * 24);
  if (ageDays >= 0 && ageDays < 30) score += 1;
  return { id: article.id, score, matchedFields: Array.from(matched) };
}
self.onmessage = (event) => {
  const message = event.data;
  if (message.type === "build") {
    articles = message.articles;
    self.postMessage({ type: "ready", count: articles.length });
    return;
  }
  if (message.type === "query") {
    const terms = tokenizeQuery(message.query);
    const limit = message.limit ?? 50;
    const started = performance.now();
    const hits = articles
      .map((article) => scoreArticle(article, terms))
      .filter((hit) => hit.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    const elapsedMs = performance.now() - started;
    self.postMessage({
      type: "results",
      requestId: message.requestId,
      hits,
      elapsedMs,
    });
  }
};
//# sourceMappingURL=search.worker.js.map

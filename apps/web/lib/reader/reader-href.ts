import { CANONICAL_READER_PATH } from "@/lib/reader-routes";
import { normalizeTopicsValue } from "./filters";
import type { ReaderHrefState } from "./types";
import type { ArticleCorpusArticle } from "@/lib/article-corpus";

export function buildReaderHref(
  state: ReaderHrefState,
  overrides: Record<string, string | string[] | null | undefined> = {},
): string {
  const params = new URLSearchParams();

  if (state.query) {
    params.set("q", state.query);
  }
  if (state.sourceType) {
    params.set("source_type", state.sourceType);
  }
  if (state.topics.length > 0) {
    params.set("topics", normalizeTopicsValue(state.topics));
  }
  if (typeof state.verified === "boolean") {
    params.set("verified", String(state.verified));
  }
  for (const feedId of state.feedIds) {
    params.append("feed", feedId);
  }
  if (state.sort !== "latest") {
    params.set("sort", state.sort);
  }
  if (state.readerView !== "latest") {
    params.set("reader_view", state.readerView);
  }
  if (state.cursor > 0) {
    params.set("cursor", String(state.cursor));
  }

  for (const [key, value] of Object.entries(overrides)) {
    params.delete(key);

    if (value == null || value === "") {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        params.append(key, entry);
      }
      continue;
    }

    params.set(key, value);
  }

  const nextQuery = params.toString();
  return nextQuery ? `${CANONICAL_READER_PATH}?${nextQuery}` : CANONICAL_READER_PATH;
}

export function buildImmersiveReaderHref(
  article: string | Pick<ArticleCorpusArticle, "id" | "title" | "link">,
): string {
  if (typeof article === "string") {
    return `/reader/article/${encodeURIComponent(article)}`;
  }

  // Derive the stable public slug using the same logic as getArticleSlug()
  // from @/lib/public-content (inlined here + pure sha1 so the module remains
  // safe to import from client components; public-content has "server-only").
  const slugifyPathSegment = (value: string): string => {
    const slug = (value ?? "")
      .trim()
      .toLowerCase()
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return slug || "item";
  };

  const titleSlug = slugifyPathSegment(article.title ?? "")
    .slice(0, 72)
    .replace(/-+$/, "");
  const digestSource = article.id || article.link || article.title || "";
  const digest = sha1(digestSource).slice(0, 10);
  const slug = `${titleSlug || "article"}-${digest}`;
  return `/reader/article/${encodeURIComponent(slug)}`;
}

function sha1(str: string): string {
  // Pure JS SHA-1 (utf8) to match Node's createHash("sha1") output exactly.
  // Validated against crypto for ascii + utf8 cases used by article ids/titles/links.
  const utf8 = new TextEncoder().encode(str);
  const words: number[] = [];
  for (let i = 0; i < utf8.length; i++) {
    words[i >>> 2] |= utf8[i] << (24 - (i % 4) * 8);
  }
  const l = utf8.length * 8;
  words[l >>> 5] |= 0x80 << (24 - (l % 32));
  words[(((l + 64) >>> 9) << 4) + 15] = l;

  let [a, b, c, d, e] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];

  for (let i = 0; i < words.length; i += 16) {
    const w = words.slice(i, i + 16);
    for (let j = 16; j < 80; j++) {
      const t = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16];
      w[j] = (t << 1) | (t >>> 31);
    }
    let [aa, bb, cc, dd, ee] = [a, b, c, d, e];
    for (let j = 0; j < 80; j++) {
      const k = (j / 20) | 0;
      const f = [
        (bb & cc) | (~bb & dd),
        bb ^ cc ^ dd,
        (bb & cc) | (bb & dd) | (cc & dd),
        bb ^ cc ^ dd,
      ][k];
      const kk = [0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6][k];
      const temp = (((aa << 5) | (aa >>> 27)) + f + ee + kk + (w[j] >>> 0)) | 0;
      ee = dd;
      dd = cc;
      cc = ((bb << 30) | (bb >>> 2)) >>> 0;
      bb = aa;
      aa = temp;
    }
    a = (a + aa) | 0;
    b = (b + bb) | 0;
    c = (c + cc) | 0;
    d = (d + dd) | 0;
    e = (e + ee) | 0;
  }

  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  return hex(a) + hex(b) + hex(c) + hex(d) + hex(e);
}

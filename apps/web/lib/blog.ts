import "server-only";

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export type BlogPost = {
  slug: string;
  title: string;
  date: string;
  summary?: string;
  content: string;
};

type Frontmatter = Record<string, string>;

function parseFrontmatter(raw: string): { frontmatter: Frontmatter; content: string } {
  const match = raw.match(/^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, content: raw.trim() };
  }
  const frontmatter: Frontmatter = {};
  const fmBlock = match[1];
  const content = match[2].trim();
  fmBlock.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (m) {
      const key = m[1].trim();
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      frontmatter[key] = val;
    }
  });
  return { frontmatter, content };
}

const PLACEHOLDER_POSTS: BlogPost[] = [
  {
    slug: "launch",
    title: "AI Web Feeds is live",
    date: "2026-06-01T00:00:00.000Z",
    summary: "Introducing a focused reader for AI writing across the open web.",
    content:
      "We built a reader, catalog, and tooling to track high-signal AI sources without the noise of social media.\n\nThe goal is simple: surface the best writing from labs, researchers, and practitioners in one calm place.",
  },
  {
    slug: "reader-updates",
    title: "Reader and local-first improvements",
    date: "2026-06-10T00:00:00.000Z",
    summary: "Dexie, virtualized streams, and keyboard navigation now ship by default.",
    content:
      "Recent work extracted the monolithic workspace into composable reader components and added local persistence layers for IndexedDB-backed articles, search, and annotations.",
  },
  {
    slug: "hub-and-blog",
    title: "Hub routes and this blog",
    date: "2026-06-15T00:00:00.000Z",
    summary: "New top-level hub sections: Search, For You, and Blog.",
    content:
      "This post marks the addition of the blog index at /blog, dedicated post pages, and the accompanying RSS/Atom/JSON Feed endpoints under the new hub navigation surface.",
  },
];

export async function loadBlogPosts(): Promise<BlogPost[]> {
  const blogDir = path.join(process.cwd(), "content", "blog");
  try {
    const entries = await readdir(blogDir);
    const mdxFiles = entries.filter((name) => name.endsWith(".mdx") || name.endsWith(".md"));
    if (mdxFiles.length === 0) {
      return [...PLACEHOLDER_POSTS].sort((a, b) => b.date.localeCompare(a.date));
    }

    const loaded: BlogPost[] = [];
    for (const name of mdxFiles) {
      const fullPath = path.join(blogDir, name);
      const raw = await readFile(fullPath, "utf8");
      const { frontmatter, content } = parseFrontmatter(raw);
      const slug = name.replace(/\.(mdx|md)$/, "");
      loaded.push({
        slug,
        title: frontmatter.title || slug,
        date: frontmatter.date || new Date().toISOString(),
        summary: frontmatter.summary || frontmatter.description || undefined,
        content,
      });
    }
    return loaded.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  } catch {
    // content/blog missing or unreadable -> return seeded placeholders
    return [...PLACEHOLDER_POSTS].sort((a, b) => b.date.localeCompare(a.date));
  }
}

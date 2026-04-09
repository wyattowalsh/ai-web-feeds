import { blog } from "@/.source";

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  tags: string[];
  excerpt?: string;
  image?: string;
  url: string;
}

type BlogEntry = (typeof blog)[number];

function slugFromPath(path: string): string {
  return path.replace(/\.mdx?$/, "");
}

function toPost(entry: BlogEntry): BlogPost {
  // frontmatter fields are merged directly onto the entry by fumadocs-mdx
  const e = entry as BlogEntry & {
    date: string;
    author: string;
    tags: string[];
    excerpt?: string;
    image?: string;
  };
  return {
    slug: slugFromPath(entry.info.path),
    title: entry.title,
    description: entry.description ?? "",
    date: e.date,
    author: e.author,
    tags: e.tags,
    excerpt: e.excerpt,
    image: e.image,
    url: `/blog/${slugFromPath(entry.info.path)}`,
  };
}

export function getAllPosts(): BlogPost[] {
  return blog.map(toPost).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getPostBySlug(slug: string) {
  const entry = blog.find((e) => slugFromPath(e.info.path) === slug);
  if (!entry) return null;
  return { ...toPost(entry), body: entry.body };
}

export function getAllSlugs(): string[] {
  return blog.map((e) => slugFromPath(e.info.path));
}

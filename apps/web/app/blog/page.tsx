import { getAllPosts } from "@/lib/blog";
import Link from "next/link";
import type { Metadata } from "next";
import { Calendar, Tag, User } from "lucide-react";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Insights on AI feeds, web data pipelines, and building with structured content for AI agents.",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogPage() {
  const posts = getAllPosts();
  const [featured, ...rest] = posts;

  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-16 space-y-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-(--line) bg-(--surface) px-3 py-1 text-xs font-semibold uppercase tracking-widest text-(--ink-muted)">
            Editorial
          </span>
          <h1 className="font-serif text-4xl font-semibold text-(--ink) sm:text-5xl">Blog</h1>
          <p className="max-w-xl text-lg text-(--ink-muted)">
            Insights on AI feeds, web data pipelines, and building with structured content for AI
            agents.
          </p>
        </div>

        {featured && (
          <Link href={featured.url} className="group mb-12 block">
            <article className="overflow-hidden rounded-3xl border border-(--line) bg-(--surface) p-8 shadow-(--surface-shadow-soft) transition-shadow hover:shadow-(--surface-shadow) sm:p-10">
              <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-(--ink-muted)">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="size-3.5" />
                  {formatDate(featured.date)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <User className="size-3.5" />
                  {featured.author}
                </span>
              </div>
              <h2 className="mb-3 font-serif text-2xl font-semibold text-(--ink) transition-colors group-hover:text-(--brand) sm:text-3xl">
                {featured.title}
              </h2>
              <p className="mb-6 leading-relaxed text-(--ink-muted)">
                {featured.excerpt ?? featured.description}
              </p>
              <div className="flex flex-wrap gap-2">
                {featured.tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-(--brand-soft) px-2.5 py-0.5 text-xs font-medium text-(--brand-strong)"
                  >
                    <Tag className="size-2.5" />
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          </Link>
        )}

        {rest.length > 0 && (
          <div className="space-y-4">
            {rest.map((post) => (
              <Link key={post.slug} href={post.url} className="group block">
                <article className="rounded-2xl border border-(--line) bg-(--surface) px-6 py-5 transition-colors hover:border-(--brand)">
                  <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-(--ink-muted)">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="size-3" />
                      {formatDate(post.date)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <User className="size-3" />
                      {post.author}
                    </span>
                  </div>
                  <h2 className="mb-1 font-serif text-xl font-semibold text-(--ink) transition-colors group-hover:text-(--brand)">
                    {post.title}
                  </h2>
                  <p className="line-clamp-2 text-sm leading-relaxed text-(--ink-muted)">
                    {post.excerpt ?? post.description}
                  </p>
                  {post.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {post.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-(--surface-muted) px-2 py-0.5 text-xs text-(--ink-muted)"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              </Link>
            ))}
          </div>
        )}

        {posts.length === 0 && (
          <p className="text-(--ink-muted)">No posts yet — check back soon.</p>
        )}
      </div>
    </main>
  );
}

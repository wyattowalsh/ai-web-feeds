import type { Metadata } from "next";
import Link from "next/link";
import { formatArticleDate } from "@/lib/reader/format";
import { createPageMetadata } from "@/lib/seo";
import { HubPage } from "@/components/hub";
import { loadBlogPosts, type BlogPost } from "@/lib/blog";

export const metadata: Metadata = createPageMetadata({
  title: "Blog - AI Web Feeds",
  description: "Product updates, reader notes, and announcements from the AI Web Feeds project.",
  path: "/blog",
});

export default async function BlogIndexPage() {
  const posts: BlogPost[] = await loadBlogPosts();

  return (
    <div className="page-wrap page-stack bg-background text-foreground">
      <HubPage
        eyebrow="Updates"
        title="Blog"
        description="Notes on the reader, catalog, local-first work, and product direction."
        actions={
          <Link
            href="/blog/rss.xml"
            className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            RSS
          </Link>
        }
      >
        <div className="space-y-4">
          {posts.length === 0 ? (
            <div className="surface-card py-8 text-center text-sm text-muted-foreground">
              No posts yet.
            </div>
          ) : (
            posts.map((post) => (
              <article
                key={post.slug}
                className="surface-card space-y-2 transition hover:border-primary/25"
              >
                <Link href={`/blog/${post.slug}`} className="group block">
                  <h2 className="text-xl font-semibold tracking-tight group-hover:text-primary">
                    {post.title}
                  </h2>
                </Link>
                {post.summary ? (
                  <p className="text-sm leading-6 text-muted-foreground">{post.summary}</p>
                ) : null}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <time dateTime={post.date}>{formatArticleDate(post.date)}</time>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    Read →
                  </Link>
                </div>
              </article>
            ))
          )}
        </div>

        <p className="small-note pt-4">
          Real posts live in <code>content/blog/*.mdx</code> when present. Currently showing seeded
          placeholders.
        </p>
      </HubPage>
    </div>
  );
}

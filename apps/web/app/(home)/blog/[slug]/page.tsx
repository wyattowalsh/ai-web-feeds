import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { getRequestNonce } from "@/lib/nonce";
import { createPageMetadata, noIndexFollowRobots } from "@/lib/seo";
import { breadcrumbsJsonLd } from "@/lib/structured-data";
import { formatArticleDate } from "@/lib/reader/format";
import { HubPage } from "@/components/hub";
import { loadBlogPosts, type BlogPost } from "@/lib/blog";

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

async function getPost(slug: string): Promise<BlogPost | null> {
  const posts = await loadBlogPosts();
  return posts.find((p) => p.slug === slug) ?? null;
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) {
    return createPageMetadata({
      title: "Post not found - AI Web Feeds Blog",
      description: "The requested blog post could not be found.",
      path: `/blog/${slug}`,
      robots: noIndexFollowRobots,
    });
  }
  return createPageMetadata({
    title: `${post.title} - AI Web Feeds Blog`,
    description: post.summary || `Blog post: ${post.title}`,
    path: `/blog/${slug}`,
    type: "article",
  });
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) {
    notFound();
  }

  const nonce = await getRequestNonce();
  const paragraphs = post.content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="page-wrap page-stack">
      <JsonLd
        nonce={nonce}
        data={[
          breadcrumbsJsonLd([
            { name: "Home", url: "/" },
            { name: "Blog", url: "/blog" },
            { name: post.title, url: `/blog/${post.slug}` },
          ]),
        ]}
      />
      <HubPage
        variant="immersive"
        eyebrow={
          <Link
            href="/blog"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ArrowLeft className="size-3.5" /> Blog
          </Link>
        }
        title={post.title}
        description={post.summary}
      >
        <div className="text-sm text-(--ink-muted)">
          <time dateTime={post.date}>{formatArticleDate(post.date)}</time>
        </div>

        <div className="surface-card space-y-5 py-8 text-[15px] leading-7 text-(--ink)">
          {paragraphs.length > 0 ? (
            paragraphs.map((para, idx) => (
              <p key={idx} className="whitespace-pre-wrap">
                {para}
              </p>
            ))
          ) : (
            <p className="whitespace-pre-wrap">{post.content}</p>
          )}
        </div>

        <div className="pt-4">
          <Link href="/blog" className="text-sm font-semibold text-primary hover:underline">
            ← Back to all posts
          </Link>
        </div>
      </HubPage>
    </div>
  );
}

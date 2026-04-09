import { getAllSlugs, getPostBySlug } from "@/lib/blog";
import { getMDXComponents } from "@/mdx-components";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, Tag, User } from "lucide-react";
import { getSiteBaseUrl } from "@/lib/env";
import Link from "next/link";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  const baseUrl = getSiteBaseUrl();

  return {
    title: post.title,
    description: post.description,
    authors: [{ name: post.author }],
    keywords: post.tags,
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url: `${baseUrl}${post.url}`,
      publishedTime: post.date,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const MDX = post.body;

  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <Link
          href="/blog"
          className="mb-10 inline-flex items-center gap-1.5 text-sm font-medium text-(--ink-muted) transition-colors hover:text-(--ink)"
        >
          <ArrowLeft className="size-3.5" />
          All posts
        </Link>

        <header className="mb-12 space-y-6">
          <div className="flex flex-wrap items-center gap-3 text-sm text-(--ink-muted)">
            <span className="inline-flex items-center gap-1">
              <Calendar className="size-3.5" />
              {formatDate(post.date)}
            </span>
            <span className="inline-flex items-center gap-1">
              <User className="size-3.5" />
              {post.author}
            </span>
          </div>
          <h1 className="font-serif text-3xl font-semibold text-(--ink) sm:text-4xl">
            {post.title}
          </h1>
          {post.description && (
            <p className="text-lg leading-relaxed text-(--ink-muted)">{post.description}</p>
          )}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-(--brand-soft) px-2.5 py-0.5 text-xs font-medium text-(--brand-strong)"
                >
                  <Tag className="size-2.5" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        <hr className="mb-12 border-(--line)" />

        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <MDX components={getMDXComponents()} />
        </article>

        <div className="mt-16 border-t border-(--line) pt-8">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-(--ink-muted) transition-colors hover:text-(--ink)"
          >
            <ArrowLeft className="size-3.5" />
            Back to all posts
          </Link>
        </div>
      </div>
    </main>
  );
}

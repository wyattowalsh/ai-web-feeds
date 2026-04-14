import { getPageImage, source } from "@/lib/source";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/page";
import { notFound } from "next/navigation";
import { getMDXComponents } from "@/mdx-components";
import type { Metadata } from "next";
import { createRelativeLink } from "fumadocs-ui/mdx";
import { BookOpenText } from "lucide-react";
import { LLMCopyButton, ViewOptions } from "@/components/page-actions";

export default async function Page(props: PageProps<"/docs/[[...slug]]">) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <div className="docs-page-header not-prose">
        <div className="space-y-4">
          <span className="eyebrow">
            <BookOpenText className="size-3.5" />
            Documentation
          </span>
          <div className="space-y-3">
            <DocsTitle>{page.data.title}</DocsTitle>
            <DocsDescription>{page.data.description}</DocsDescription>
          </div>
        </div>

        <div className="docs-page-actions">
          <div className="flex flex-wrap items-center gap-2">
            <LLMCopyButton markdownUrl={`${page.url}.mdx`} />
            <ViewOptions
              markdownUrl={`${page.url}.mdx`}
              githubUrl={`https://github.com/wyattowalsh/ai-web-feeds/blob/main/apps/web/content/docs/${page.file.path}`}
            />
          </div>
          <p className="small-note">Source: apps/web/content/docs/{page.file.path}</p>
        </div>
      </div>

      <DocsBody>
        <MDX
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps<"/docs/[[...slug]]">): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://aiwebfeeds.vercel.app";
  const pageUrl = `${baseUrl}${page.url}`;
  const imageUrl = `${baseUrl}${getPageImage(page).url}`;

  return {
    title: page.data.title,
    description: page.data.description,
    authors: [
      {
        name: "Wyatt Walsh",
        url: "https://github.com/wyattowalsh",
      },
    ],
    creator: "Wyatt Walsh",
    publisher: "AI Web Feeds",
    keywords: [
      "documentation",
      "AI",
      "LLM",
      "RSS feeds",
      "Atom feeds",
      "web feeds",
      "AI agents",
      "machine learning",
      page.data.title,
    ],
    openGraph: {
      type: "article",
      title: page.data.title,
      description: page.data.description,
      url: pageUrl,
      siteName: "AI Web Feeds",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: page.data.title,
        },
      ],
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: page.data.title,
      description: page.data.description,
      images: [imageUrl],
      creator: "@wyattowalsh",
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    alternates: {
      canonical: pageUrl,
      types: {
        "application/rss+xml": `${baseUrl}/docs/rss.xml`,
        "application/atom+xml": `${baseUrl}/docs/atom.xml`,
        "application/feed+json": `${baseUrl}/docs/feed.json`,
      },
    },
  };
}

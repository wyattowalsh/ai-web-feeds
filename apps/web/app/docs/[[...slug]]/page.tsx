import { getPageImage, source } from "@/lib/source";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/page";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { getMDXComponents } from "@/mdx-components";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { createRelativeLink } from "fumadocs-ui/mdx";
import { BookOpenText } from "lucide-react";
import { LLMCopyButton, ViewOptions } from "@/components/page-actions";
import {
  absoluteUrl,
  publicSeoRobots,
  SITE_AUTHOR,
  SITE_AUTHOR_URL,
  SITE_NAME,
  SITE_TWITTER_HANDLE,
} from "@/lib/seo";
import { breadcrumbsJsonLd } from "@/lib/structured-data";

type DocsPageProps = {
  params: Promise<{
    slug?: string[];
  }>;
};

export default async function Page(props: DocsPageProps) {
  const params = await props.params;
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <>
      <JsonLd
        nonce={nonce}
        data={breadcrumbsJsonLd([
          { name: "Home", url: "/" },
          { name: "Documentation", url: "/docs" },
          { name: page.data.title, url: page.url },
        ])}
      />
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
    </>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: DocsPageProps): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const pageUrl = absoluteUrl(page.url);
  const imageUrl = absoluteUrl(getPageImage(page).url);

  return {
    title: page.data.title,
    description: page.data.description,
    authors: [
      {
        name: SITE_AUTHOR,
        url: SITE_AUTHOR_URL,
      },
    ],
    creator: SITE_AUTHOR,
    publisher: SITE_NAME,
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
      siteName: SITE_NAME,
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
      creator: SITE_TWITTER_HANDLE,
    },
    robots: publicSeoRobots,
    alternates: {
      canonical: pageUrl,
      types: {
        "application/rss+xml": absoluteUrl("/docs/rss.xml"),
        "application/atom+xml": absoluteUrl("/docs/atom.xml"),
        "application/feed+json": absoluteUrl("/docs/feed.json"),
      },
    },
  };
}

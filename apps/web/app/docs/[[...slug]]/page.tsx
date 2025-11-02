import { getPageImage, source } from "@/lib/source";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/page";
import { notFound } from "next/navigation";
import { getMDXComponents } from "@/mdx-components";
import type { Metadata } from "next";
import { createRelativeLink } from "fumadocs-ui/mdx";
import { LLMCopyButton, ViewOptions } from "@/components/page-actions";

export default async function Page(props: PageProps<"/docs/[[...slug]]">) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>

      {/* AI Page Actions */}
      <div className="flex flex-row gap-2 items-center border-b pt-2 pb-6 mb-6">
        <LLMCopyButton markdownUrl={`${page.url}.mdx`} />
        <ViewOptions
          markdownUrl={`${page.url}.mdx`}
          githubUrl={`https://github.com/wyattowalsh/ai-web-feeds/blob/main/apps/web/content/docs/${page.file.path}`}
        />
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

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://ai-web-feeds.vercel.app";
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
        "application/json": `${baseUrl}/docs/feed.json`,
      },
    },
  };
}

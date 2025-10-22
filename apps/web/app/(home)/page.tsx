import Link from 'next/link';
import type { Metadata } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ai-web-feeds.vercel.app';

export const metadata: Metadata = {
  title: 'AI Web Feeds - RSS/Atom Feeds for AI Agents & LLMs',
  description: 'Curated RSS/Atom feeds optimized for AI agents and large language models. Features PDF export, LLM-friendly endpoints, and comprehensive feed support for seamless AI integration.',
  openGraph: {
    title: 'AI Web Feeds - RSS/Atom Feeds for AI Agents',
    description: 'Curated RSS/Atom feeds optimized for AI agents and large language models',
    url: baseUrl,
    type: 'website',
    images: [
      {
        url: `${baseUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'AI Web Feeds',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Web Feeds - RSS/Atom Feeds for AI Agents',
    description: 'Curated RSS/Atom feeds optimized for AI agents and large language models',
    images: [`${baseUrl}/og-image.png`],
  },
};

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col justify-center text-center">
      <h1 className="mb-4 text-2xl font-bold">Hello World</h1>
      <p className="text-fd-muted-foreground">
        You can open{' '}
        <Link
          href="/docs"
          className="text-fd-foreground font-semibold underline"
        >
          /docs
        </Link>{' '}
        and see the documentation.
      </p>
    </main>
  );
}

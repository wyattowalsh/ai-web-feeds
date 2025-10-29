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
  const features = [
    {
      title: '📊 Analytics Dashboard',
      description: 'Real-time feed analytics with interactive visualizations, trending topics, and health insights',
      href: '/analytics',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      title: '🔍 Search & Discovery',
      description: 'Full-text and semantic search powered by SQLite FTS5 and AI embeddings',
      href: '/search',
      color: 'from-purple-500 to-pink-500',
    },
    {
      title: '🤖 AI Recommendations',
      description: 'Personalized feed suggestions using content-based filtering and popularity',
      href: '/recommendations',
      color: 'from-indigo-500 to-purple-500',
    },
    {
      title: '📂 Feed Explorer',
      description: 'Browse and explore all feeds with filters, search, and topic visualization',
      href: '/explorer',
      color: 'from-violet-500 to-indigo-500',
    },
    {
      title: '📚 Documentation',
      description: 'Comprehensive guides, API reference, and development documentation',
      href: '/docs',
      color: 'from-green-500 to-emerald-500',
    },
    {
      title: '📡 Feeds',
      description: 'View and manage feed catalog with validation status indicators',
      href: '/feeds',
      color: 'from-orange-500 to-red-500',
    },
    {
      title: '📥 Downloads',
      description: 'Export feeds in OPML format for your favorite feed reader',
      href: '/downloads',
      color: 'from-pink-500 to-rose-500',
    },
    {
      title: '🤖 LLM Formats',
      description: 'Access documentation in LLM-friendly formats for AI agents',
      href: '/llms-full.txt',
      color: 'from-yellow-500 to-orange-500',
    },
  ];

  return (
    <main className="flex flex-1 flex-col justify-center px-4 py-12">
      <div className="mx-auto max-w-6xl w-full">
        <div className="text-center mb-12">
          <h1 className="mb-4 text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            AI Web Feeds
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Curated RSS/Atom feeds optimized for AI agents and large language models.
            Features analytics, exploration, and comprehensive feed management.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
        <Link
              key={feature.href}
              href={feature.href}
              className="group relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6 transition-all hover:shadow-lg hover:scale-105"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-10 transition-opacity`} />
              <div className="relative">
                <h3 className="mb-2 text-xl font-semibold">{feature.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {feature.description}
                </p>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Open source project by{' '}
            <a
              href="https://github.com/wyattowalsh"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline hover:text-blue-600"
            >
              Wyatt Walsh
            </a>
            {' · '}
            <a
              href="https://github.com/wyattowalsh/ai-web-feeds"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline hover:text-blue-600"
            >
              View on GitHub
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}

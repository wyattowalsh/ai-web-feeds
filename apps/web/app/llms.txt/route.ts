import { source } from '@/lib/source';

export const revalidate = false;

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const pages = source.getPages();
  
  // Generate llms.txt format with links to markdown versions
  const lines = [
    '# AI Web Feeds Documentation',
    '',
    '> A collection of curated RSS/Atom feeds optimized for AI agents and LLMs',
    '',
    '## Documentation Pages',
    '',
    ...pages.map(page => `- [${page.data.title}](${origin}${page.url}.mdx): ${page.data.description || page.data.title}`),
    '',
    '## Full Documentation',
    '',
    `- [Complete Documentation (Text)](${origin}/llms-full.txt)`,
    '',
    '## Individual Pages',
    '',
    'Append `.mdx` or `.md` to any documentation URL to get the markdown version.',
    'Example: `/docs/getting-started.mdx`',
    '',
    '## API',
    '',
    'Use the `Accept: text/markdown` header to automatically receive markdown content.',
  ];

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}

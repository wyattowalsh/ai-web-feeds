import { getLLMText } from '@/lib/source';
import { source } from '@/lib/source';
import { notFound } from 'next/navigation';

export const revalidate = false;

interface RouteContext {
  params: Promise<{
    slug?: string[];
  }>;
}

export async function GET(_req: Request, context: RouteContext) {
  const { slug } = await context.params;
  const page = source.getPage(slug);
  
  if (!page) {
    notFound();
  }

  const content = await getLLMText(page);

  return new Response(content, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

export function generateStaticParams() {
  return source.generateParams();
}

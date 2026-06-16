import "server-only";

import { loadArticleCorpus } from "@/lib/article-corpus";
import { getArticleBySlug } from "@/lib/public-content";
import type { ArticleCorpusArticle } from "@/lib/article-corpus";

/**
 * Server-only helper to load an article for the immersive reader route.
 * Accepts a public slug or raw corpus article id.
 */
export async function loadArticleForReader(
  articleId: string,
): Promise<ArticleCorpusArticle | null> {
  if (!articleId || typeof articleId !== "string") {
    return null;
  }

  try {
    const bySlug = await getArticleBySlug(articleId);
    if (bySlug) {
      return bySlug;
    }

    const corpus = await loadArticleCorpus();
    return (
      corpus.articles.find(
        (article) => article.id === articleId || `${article.feed_id}:${article.id}` === articleId,
      ) ?? null
    );
  } catch {
    return null;
  }
}

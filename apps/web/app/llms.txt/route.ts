import { source } from "@/lib/source";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

export const revalidate = false;

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const baseUrl = SITE_URL || origin;
  const pages = source.getPages();

  // Generate llms.txt format with links to markdown versions
  const lines = [
    `# ${SITE_NAME} Documentation`,
    "",
    "> A focused reader and source catalog for AI writing across the open web.",
    "",
    `Canonical site: ${baseUrl}`,
    "",
    "## Primary Pages",
    "",
    `- [Reader](${baseUrl}/reader): Read recent AI writing from tracked sources.`,
    `- [Sources](${baseUrl}/sources): Browse the source catalog.`,
    `- [Dashboard](${baseUrl}/dashboard): Inspect catalog health and coverage.`,
    `- [Source pages](${baseUrl}/sources/{sourceId}): Crawlable source landing pages.`,
    `- [Topic pages](${baseUrl}/topics/{topicId}): Crawlable topic collections.`,
    `- [Article references](${baseUrl}/articles/{articleId}): Noindex summary and attribution pages when an article corpus exists.`,
    "",
    "## Documentation Pages",
    "",
    ...pages.map(
      (page) =>
        `- [${page.data.title}](${baseUrl}${page.url}.mdx): ${
          page.data.description || page.data.title
        }`,
    ),
    "",
    "## Full Documentation",
    "",
    `- [Complete Documentation (Text)](${baseUrl}/llms-full.txt)`,
    "",
    "## Individual Pages",
    "",
    "Append `.mdx` or `.md` to any documentation URL to get the markdown version.",
    "Example: `/docs/getting-started.mdx`",
    "",
    "## API",
    "",
    "Use the `Accept: text/markdown` header to automatically receive markdown content.",
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}

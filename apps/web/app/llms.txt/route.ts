import { getDocSectionInfo, source } from "@/lib/source";

export const revalidate = false;

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const pages = source.getPages();
  const groupedPages = Array.from(
    pages.reduce((groups, page) => {
      const section = getDocSectionInfo(page.slugs);
      const existing = groups.get(section.key);

      if (existing) {
        existing.pages.push(page);
        return groups;
      }

      groups.set(section.key, {
        section,
        pages: [page],
      });
      return groups;
    }, new Map<string, { section: ReturnType<typeof getDocSectionInfo>; pages: Array<(typeof pages)[number]> }>()),
  );

  // Generate llms.txt format with links to markdown versions
  const lines = [
    "# AI Web Feeds Documentation",
    "",
    "> A collection of curated RSS/Atom feeds optimized for AI agents and LLMs",
    "",
    "## Documentation Pages",
    "",
    ...groupedPages.flatMap(({ section, pages: sectionPages }) => [
      `### ${section.title}`,
      "",
      ...sectionPages.map(
        (page) =>
          `- [${section.title} / ${page.data.title}](${origin}${page.url}.mdx): ${
            page.data.description || page.data.title
          }`,
      ),
      "",
    ]),
    "",
    "## Full Documentation",
    "",
    `- [Complete Documentation (Text)](${origin}/llms-full.txt)`,
    "",
    "## Individual Pages",
    "",
    "Append `.mdx` or `.md` to any documentation URL to get the markdown version.",
    "Canonical nested path example: `/docs/guides/getting-started.mdx`",
    "Root index example: `/docs.mdx`",
    "`.md` and `.mdx` currently return the same `text/markdown` payload.",
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

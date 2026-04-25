import { getDocSectionInfo, getLLMText, source } from "@/lib/source";

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

  // Get current date in ISO format
  const generatedDate = new Date().toISOString();

  // Build structured content with metadata header
  const header = [
    "=".repeat(80),
    "AI WEB FEEDS - COMPLETE DOCUMENTATION",
    "=".repeat(80),
    "",
    "METADATA",
    "-".repeat(80),
    `Generated: ${generatedDate}`,
    `Total Pages: ${pages.length}`,
    `Base URL: ${origin}`,
    `Format: Markdown`,
    `Encoding: UTF-8`,
    "",
    "DESCRIPTION",
    "-".repeat(80),
    "A comprehensive collection of curated RSS/Atom feeds optimized for AI agents",
    "and large language models. This document contains the complete documentation",
    "for the AI Web Feeds project, including setup guides, API references, and",
    "usage examples.",
    "",
    "STRUCTURE",
    "-".repeat(80),
    "Each page section follows this format:",
    "  - Page separator (===)",
    "  - Page title and URL",
    "  - Page metadata (description, tags, etc.)",
    "  - Content separator (---)",
    "  - Full markdown content",
    "",
    "NAVIGATION",
    "-".repeat(80),
    "Table of Contents:",
    "",
    ...groupedPages.flatMap(({ section, pages: sectionPages }) => [
      `  [${section.title}]`,
      ...sectionPages.map(
        (page) =>
          `    ${pages.findIndex((candidate) => candidate.url === page.url) + 1}. ${
            page.data.title
          } - ${page.url}`,
      ),
      "",
    ]),
    "",
    "=".repeat(80),
    "DOCUMENTATION CONTENT",
    "=".repeat(80),
    "",
  ].join("\n");

  // Process pages with enhanced formatting
  const processedPages = await Promise.all(
    pages.map(async (page, index) => {
      const content = await getLLMText(page);
      const section = getDocSectionInfo(page.slugs);

      const lines = [
        "",
        "=".repeat(80),
        `PAGE ${index + 1} OF ${pages.length}`,
        "=".repeat(80),
        "",
        `TITLE: ${page.data.title}`,
        `URL: ${origin}${page.url}`,
        `MARKDOWN: ${origin}${page.url}.mdx`,
        ...(page.data.description ? [`DESCRIPTION: ${page.data.description}`] : []),
        `SECTION: ${section.title}`,
        `SECTION_KEY: ${section.key}`,
        `PATH: ${page.url}`,
        "",
        "-".repeat(80),
        "CONTENT",
        "-".repeat(80),
        "",
        content,
        "",
        "-".repeat(80),
        `END OF PAGE ${index + 1}`,
        "-".repeat(80),
        "",
      ];

      return lines.join("\n");
    }),
  );

  // Build final document
  const footer = [
    "",
    "=".repeat(80),
    "END OF DOCUMENTATION",
    "=".repeat(80),
    "",
    `Total pages processed: ${pages.length}`,
    `Generated: ${generatedDate}`,
    `Format: Plain text with markdown content`,
    "",
    "For individual pages, append .mdx or .md to any documentation URL.",
    "For the discovery file, visit /llms.txt",
    "",
    "=".repeat(80),
  ].join("\n");

  const fullContent = header + processedPages.join("\n") + footer;

  return new Response(fullContent, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "X-Content-Pages": pages.length.toString(),
      "X-Generated-Date": generatedDate,
    },
  });
}

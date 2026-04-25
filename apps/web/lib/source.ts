import { docs } from "@/.source";
import { type InferPageType, loader } from "fumadocs-core/source";
import { lucideIconsPlugin } from "fumadocs-core/source/lucide-icons";

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
});

interface DocsMetaSection {
  title?: string;
}

function hasMetaSection(sectionKey: string | undefined): boolean {
  if (!sectionKey) {
    return false;
  }

  const section = meta[sectionKey as keyof typeof meta];
  return Boolean(section && typeof section === "object" && !Array.isArray(section));
}

function readSectionTitle(sectionKey: string | undefined): string {
  if (!sectionKey) {
    return meta.title;
  }

  const section = meta[sectionKey as keyof typeof meta];
  if (section && typeof section === "object" && !Array.isArray(section)) {
    const title = (section as DocsMetaSection).title;
    if (typeof title === "string" && title.length > 0) {
      return title;
    }
  }

  return meta.title;
}

export function getDocSectionInfo(slugs: string[]) {
  const sectionKey = hasMetaSection(slugs[0]) ? slugs[0] : undefined;
  const title = readSectionTitle(sectionKey);

  return {
    key: sectionKey ?? "root",
    title,
    url: sectionKey && sectionKey.length > 0 ? `/docs/${sectionKey}` : "/docs",
  };
}

export function getPageImage(page: InferPageType<typeof source>) {
  const segments = [...page.slugs, "image.png"];

  return {
    segments,
    url: `/og/docs/${segments.join("/")}`,
  };
}

export async function getLLMText(page: InferPageType<typeof source>) {
  const processed = await page.data.getText("processed");

  const lines = [
    `# ${page.data.title}`,
    "",
    `URL: ${page.url}`,
    `MARKDOWN: ${page.url}.mdx`,
    `SECTION: ${section.title}`,
    ...(page.data.description ? [`SUMMARY: ${page.data.description}`] : []),
    "",
    processed,
  ];

  return lines.join("\n");
}

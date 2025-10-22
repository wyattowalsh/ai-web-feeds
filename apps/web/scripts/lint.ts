import {
  type FileObject,
  printErrors,
  scanURLs,
  validateFiles,
} from 'next-validate-link';
import type { InferPageType } from 'fumadocs-core/source';
import { source } from '@/lib/source';

/**
 * Validate all links in documentation files
 * 
 * This script checks:
 * - Internal links between documentation pages
 * - Anchor links to headings
 * - Links in MDX components (Cards, etc.)
 * - Relative paths
 * 
 * Usage: bun ./scripts/lint.ts
 */
async function checkLinks() {
  console.log('🔍 Scanning URLs and validating links...\n');

  // Scan all URLs from Next.js routes and documentation pages
  const scanned = await scanURLs({
    // Use Next.js preset for routing
    preset: 'next',
    // Populate dynamic routes with actual page data
    populate: {
      'docs/[[...slug]]': source.getPages().map((page) => {
        return {
          value: {
            slug: page.slugs,
          },
          // Include headings for anchor link validation
          hashes: getHeadings(page),
        };
      }),
    },
  });

  // Validate all files
  const errors = await validateFiles(await getFiles(), {
    scanned,
    // Check href attributes in MDX components
    markdown: {
      components: {
        Card: { attributes: ['href'] },
      },
    },
    // Validate relative paths as URLs
    checkRelativePaths: 'as-url',
  });

  // Print validation results
  printErrors(errors, true);

  // Exit with error code if validation failed
  if (errors.length > 0) {
    console.error(`\n❌ Found ${errors.length} link validation error(s)`);
    process.exit(1);
  } else {
    console.log('\n✅ All links are valid!');
  }
}

/**
 * Extract heading anchors from a page's table of contents
 */
function getHeadings({ data }: InferPageType<typeof source>): string[] {
  return data.toc.map((item) => item.url.slice(1)); // Remove leading '#'
}

/**
 * Get all documentation files with their content
 */
async function getFiles(): Promise<FileObject[]> {
  const promises = source.getPages().map(
    async (page): Promise<FileObject> => ({
      path: page.absolutePath,
      content: await page.data.getText('raw'),
      url: page.url,
      data: page.data,
    }),
  );

  return Promise.all(promises);
}

// Run the validation
void checkLinks();

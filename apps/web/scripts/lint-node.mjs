/**
 * Link validation script for Node.js runtime
 * Alternative to lint.ts for environments without Bun
 */

import {
  printErrors,
  scanURLs,
  validateFiles,
} from 'next-validate-link';
import { readFile } from 'fs/promises';
import { loader } from 'fumadocs-core/source';
import { createMDXSource } from 'fumadocs-mdx';
import { map } from '@/.map';

const source = loader({
  baseUrl: '/docs',
  source: createMDXSource(map),
});

/**
 * Get headings from a page for anchor validation
 */
function getHeadings(page) {
  return page.data.toc?.map((heading) => heading.url.slice(1)) ?? [];
}

/**
 * Get all documentation files with their content
 */
async function getFiles() {
  const pages = source.getPages();

  const promises = pages.map(async (page) => {
    const content = await readFile(page.absolutePath, 'utf-8');
    
    return {
      path: page.absolutePath,
      content,
      url: page.url,
      data: page.data,
    };
  });

  return Promise.all(promises);
}

/**
 * Main validation function
 */
async function checkLinks() {
  console.log('🔍 Scanning URLs and validating links...\n');

  // Scan all URLs from Next.js routes
  const scanned = await scanURLs({
    preset: 'next',
    populate: {
      'docs/[[...slug]]': source.getPages().map((page) => ({
        value: { slug: page.slugs },
        hashes: getHeadings(page),
      })),
    },
  });

  // Get all files and validate
  const errors = await validateFiles(await getFiles(), {
    scanned,
    markdown: {
      components: {
        Card: { attributes: ['href'] },
      },
    },
    checkRelativePaths: 'as-url',
  });

  // Print results
  printErrors(errors, true);

  if (errors.length > 0) {
    console.log(`\n❌ Found ${errors.length} link validation error(s)\n`);
    process.exit(1);
  } else {
    console.log('\n✅ All links are valid!\n');
  }
}

// Run validation
checkLinks().catch((error) => {
  console.error('❌ Error running link validation:', error);
  process.exit(1);
});

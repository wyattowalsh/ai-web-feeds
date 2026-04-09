/**
 * Link validation script for Node.js runtime
 * Alternative to lint.ts for environments without Bun
 */

import {
  printErrors,
  scanURLs,
  validateFiles,
} from 'next-validate-link';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'content',
  'docs',
);

function toAnchorSlug(text) {
  const normalized = text
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/`+/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\{[^}]+\}/g, '')
    .replace(/[*_~]/g, '')
    .replace(/&amp;/gi, 'and')
    .replace(/&/g, 'and')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  return normalized;
}

function extractHeadings(content) {
  const hashes = [];
  const seen = new Map();
  const lines = content.split('\n');
  let inFrontmatter = false;
  let frontmatterConsumed = false;
  let inCodeFence = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!frontmatterConsumed && trimmed === '---') {
      inFrontmatter = !inFrontmatter;
      if (!inFrontmatter) {
        frontmatterConsumed = true;
      }
      continue;
    }

    if (inFrontmatter) {
      continue;
    }

    if (/^(```|~~~)/.test(trimmed)) {
      inCodeFence = !inCodeFence;
      continue;
    }

    if (inCodeFence) {
      continue;
    }

    const match = /^(#{1,6})\s+(.+)$/.exec(line);
    if (!match) {
      continue;
    }

    const base = toAnchorSlug(match[2]);
    if (!base) {
      continue;
    }

    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    hashes.push(count === 0 ? base : `${base}-${count}`);
  }

  return hashes;
}

function toSlugs(relativePath) {
  const slugs = relativePath
    .replace(/\.mdx$/, '')
    .split(path.sep)
    .filter(Boolean);

  if (slugs.at(-1) === 'index') {
    slugs.pop();
  }

  return slugs;
}

function toDocUrl(slugs) {
  return slugs.length === 0 ? '/docs' : `/docs/${slugs.join('/')}`;
}

function sanitizeForLinkValidation(content) {
  return content.replace(/\$\$[\s\S]*?\$\$/g, '\nMATH_BLOCK\n');
}

async function collectDocPages(dir = DOCS_ROOT) {
  const entries = await readdir(dir, { withFileTypes: true });
  const pages = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        return collectDocPages(absolutePath);
      }

      if (!entry.isFile() || !entry.name.endsWith('.mdx')) {
        return [];
      }

      const content = await readFile(absolutePath, 'utf-8');
      const relativePath = path.relative(DOCS_ROOT, absolutePath);
      const slugs = toSlugs(relativePath);

      return [
        {
          path: absolutePath,
          content: sanitizeForLinkValidation(content),
          url: toDocUrl(slugs),
          slugs,
          hashes: extractHeadings(content),
        },
      ];
    }),
  );

  return pages.flat();
}

/**
 * Get all documentation files with their content
 */
function getFiles(pages) {
  return pages.map(({ path: pagePath, content, url }) => ({
    path: pagePath,
    content,
    url,
    data: {},
  }));
}

async function validatePageFiles(pages, options) {
  const errors = [];

  for (const file of getFiles(pages)) {
    try {
      errors.push(...(await validateFiles([file], options)));
    } catch (error) {
      throw new Error(
        `Failed while parsing ${path.relative(DOCS_ROOT, file.path)}: ${error.message}`,
        { cause: error },
      );
    }
  }

  return errors;
}

/**
 * Main validation function
 */
async function checkLinks() {
  console.log('🔍 Scanning URLs and validating links...\n');
  const pages = await collectDocPages();

  // Scan all URLs from Next.js routes
  const scanned = await scanURLs({
    preset: 'next',
    populate: {
      'docs/[[...slug]]': pages.map((page) => ({
        value: { slug: page.slugs },
        hashes: page.hashes,
      })),
    },
  });

  // Get all files and validate
  const errors = await validatePageFiles(pages, {
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

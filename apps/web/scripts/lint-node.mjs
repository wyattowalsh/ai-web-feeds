/**
 * Link validation script for Node.js runtime
 * Alternative to lint.ts for environments without Bun
 */

import {
  printErrors,
  scanURLs,
  validateFiles,
} from 'next-validate-link';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.resolve(scriptDir, '../content/docs');

/**
 * Recursively collect documentation files without importing compiled MDX modules.
 */
async function getDocPaths(dir = docsRoot) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const resolved = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return getDocPaths(resolved);
      }

      if (entry.isFile() && entry.name.endsWith('.mdx')) {
        return [resolved];
      }

      return [];
    }),
  );

  return files.flat();
}

function stripFrontmatter(content) {
  const frontmatter = /^---\n[\s\S]*?\n---\n/;
  return content.replace(frontmatter, '');
}

function sanitizeMarkdownForValidation(content) {
  return content
    .replace(/^import\s+.+$/gm, '')
    .replace(/^export\s+.+$/gm, '')
    .replace(/\$\$[\s\S]*?\$\$/g, '\n')
    .replace(/(?<!\\)\$([^$\n]+)\$/g, '$1');
}

function slugifyHeading(text) {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\{#.*\}$/, '')
    .replace(/&/g, ' and ')
    .replace(/[`*_~[\]()<>{}:!?,./\\|"'@#$%^+=;]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function getHeadings(content) {
  const headings = [];
  const counts = new Map();
  const lines = stripFrontmatter(content).split('\n');
  let inCodeFence = false;

  for (const line of lines) {
    if (line.startsWith('```')) {
      inCodeFence = !inCodeFence;
      continue;
    }

    if (inCodeFence) {
      continue;
    }

    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (!match) {
      continue;
    }

    const baseSlug = slugifyHeading(match[2]);
    if (!baseSlug) {
      continue;
    }

    const duplicateCount = counts.get(baseSlug) ?? 0;
    counts.set(baseSlug, duplicateCount + 1);
    headings.push(duplicateCount === 0 ? baseSlug : `${baseSlug}-${duplicateCount}`);
  }

  return headings;
}

function getDocUrl(filePath) {
  const relativePath = path.relative(docsRoot, filePath).replaceAll(path.sep, '/');
  const withoutExtension = relativePath.replace(/\.mdx$/, '');

  if (withoutExtension === 'index') {
    return '/docs';
  }

  if (withoutExtension.endsWith('/index')) {
    return `/docs/${withoutExtension.slice(0, -'/index'.length)}`;
  }

  return `/docs/${withoutExtension}`;
}

function getDocSlugs(url) {
  const relativeUrl = url.replace(/^\/docs\/?/, '');
  return relativeUrl.length === 0 ? [] : relativeUrl.split('/');
}

/**
 * Get all documentation files with their content
 */
async function getFiles() {
  const docPaths = await getDocPaths();
  const promises = docPaths.map(async (docPath) => {
    const content = sanitizeMarkdownForValidation(await readFile(docPath, 'utf-8'));

    return {
      path: docPath,
      content,
      url: getDocUrl(docPath),
      data: {},
    };
  });

  return Promise.all(promises);
}

/**
 * Main validation function
 */
async function checkLinks() {
  console.log('🔍 Scanning URLs and validating links...\n');
  const docPaths = await getDocPaths();
  const docs = await Promise.all(
    docPaths.map(async (docPath) => {
      const content = await readFile(docPath, 'utf-8');
      const url = getDocUrl(docPath);

      return {
        value: { slug: getDocSlugs(url) },
        hashes: getHeadings(content),
      };
    }),
  );

  // Scan all URLs from Next.js routes
  const scanned = await scanURLs({
    preset: 'next',
    populate: {
      'docs/[[...slug]]': docs,
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

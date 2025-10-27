/**
 * Data Export Utilities
 * 
 * Export all data in various formats:
 * - JSON: Complete backup of all data
 * - CSV: Articles list for spreadsheets
 * - OPML: Feed subscriptions for other readers
 * - HTML: Static website for offline browsing
 * 
 * All exports generated client-side, no backend required
 */

import {
  articles,
  feeds,
  folders,
  readingHistory,
  annotations,
  preferences,
  type Article,
  type Feed,
  type Folder,
  type ReadingHistoryEntry,
  type Annotation,
  type Preferences,
} from './db';

export interface ExportData {
  version: string;
  exportedAt: number;
  articles: Article[];
  feeds: Feed[];
  folders: Folder[];
  readingHistory: ReadingHistoryEntry[];
  annotations: Annotation[];
  preferences: Preferences;
}

/**
 * Export all data as JSON
 */
export async function exportJSON(): Promise<Blob> {
  const data: ExportData = {
    version: '1.0',
    exportedAt: Date.now(),
    articles: await articles.getAll(),
    feeds: await feeds.getAll(),
    folders: await folders.getAll(),
    readingHistory: await readingHistory.getAll(),
    annotations: await annotations.getAll(),
    preferences: await preferences.get(),
  };

  const json = JSON.stringify(data, null, 2);
  return new Blob([json], { type: 'application/json' });
}

/**
 * Export articles as CSV
 */
export async function exportCSV(): Promise<Blob> {
  const allArticles = await articles.getAll();
  
  const headers = [
    'Title',
    'Feed',
    'Link',
    'Author',
    'Published Date',
    'Categories',
    'Read',
    'Starred',
    'Archived',
    'Tags',
    'Word Count',
    'Reading Time (min)',
  ];

  const rows = allArticles.map((article) => [
    escapeCsv(article.title),
    escapeCsv(article.feedId),
    escapeCsv(article.link),
    escapeCsv(article.author || ''),
    new Date(article.pubDate).toISOString(),
    escapeCsv(article.categories.join(', ')),
    article.read ? 'Yes' : 'No',
    article.starred ? 'Yes' : 'No',
    article.archived ? 'Yes' : 'No',
    escapeCsv(article.tags.join(', ')),
    article.wordCount || '',
    article.readingTime || '',
  ]);

  const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
  return new Blob([csv], { type: 'text/csv' });
}

/**
 * Export feeds as OPML
 */
export async function exportOPML(): Promise<Blob> {
  const allFeeds = await feeds.getAll();
  const allFolders = await folders.getAll();

  const xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<opml version="2.0">'];

  xml.push('  <head>');
  xml.push(`    <title>AI Web Feeds Export</title>`);
  xml.push(`    <dateCreated>${new Date().toUTCString()}</dateCreated>`);
  xml.push('  </head>');

  xml.push('  <body>');

  // Group feeds by folder
  const feedsByFolder = new Map<string, Feed[]>();
  allFeeds.forEach((feed) => {
    const folderId = feed.folderId || 'root';
    if (!feedsByFolder.has(folderId)) {
      feedsByFolder.set(folderId, []);
    }
    feedsByFolder.get(folderId)!.push(feed);
  });

  // Add root feeds (no folder)
  const rootFeeds = feedsByFolder.get('root') || [];
  rootFeeds.forEach((feed) => {
    xml.push(
      `    <outline type="rss" text="${escapeXml(feed.title)}" title="${escapeXml(
        feed.title
      )}" xmlUrl="${escapeXml(feed.url)}" htmlUrl="${escapeXml(feed.link || feed.url)}"/>`
    );
  });

  // Add folders with feeds
  allFolders.forEach((folder) => {
    const folderFeeds = feedsByFolder.get(folder.id) || [];
    if (folderFeeds.length > 0) {
      xml.push(`    <outline text="${escapeXml(folder.name)}" title="${escapeXml(folder.name)}">`);
      folderFeeds.forEach((feed) => {
        xml.push(
          `      <outline type="rss" text="${escapeXml(feed.title)}" title="${escapeXml(
            feed.title
          )}" xmlUrl="${escapeXml(feed.url)}" htmlUrl="${escapeXml(feed.link || feed.url)}"/>`
        );
      });
      xml.push('    </outline>');
    }
  });

  xml.push('  </body>');
  xml.push('</opml>');

  return new Blob([xml.join('\n')], { type: 'text/x-opml' });
}

/**
 * Export as static HTML website
 */
export async function exportHTML(): Promise<Blob> {
  const allArticles = await articles.getAll();
  const allFeeds = await feeds.getAll();
  const prefs = await preferences.get();

  const html = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="UTF-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '  <title>AI Web Feeds Archive</title>',
    '  <style>',
    '    * { margin: 0; padding: 0; box-sizing: border-box; }',
    '    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 20px; }',
    '    header { border-bottom: 2px solid #0066cc; padding-bottom: 20px; margin-bottom: 30px; }',
    '    h1 { color: #0066cc; margin-bottom: 10px; }',
    '    .stats { color: #666; font-size: 14px; }',
    '    .search { margin: 20px 0; }',
    '    .search input { width: 100%; padding: 12px; font-size: 16px; border: 2px solid #ddd; border-radius: 6px; }',
    '    .filters { margin: 20px 0; display: flex; gap: 10px; flex-wrap: wrap; }',
    '    .filter-btn { padding: 8px 16px; border: 1px solid #ddd; background: #f8f9fa; border-radius: 4px; cursor: pointer; }',
    '    .filter-btn.active { background: #0066cc; color: white; border-color: #0066cc; }',
    '    .article { border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin-bottom: 20px; }',
    '    .article.hidden { display: none; }',
    '    .article-header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px; }',
    '    .article-title { font-size: 20px; font-weight: 600; color: #212529; }',
    '    .article-title a { color: #0066cc; text-decoration: none; }',
    '    .article-title a:hover { text-decoration: underline; }',
    '    .article-meta { color: #6c757d; font-size: 14px; margin-bottom: 10px; }',
    '    .article-badges { display: flex; gap: 8px; }',
    '    .badge { padding: 2px 8px; border-radius: 4px; font-size: 12px; }',
    '    .badge-read { background: #d4edda; color: #155724; }',
    '    .badge-starred { background: #fff3cd; color: #856404; }',
    '    .badge-archived { background: #f8d7da; color: #721c24; }',
    '    .article-content { color: #495057; margin-top: 10px; }',
    '    .categories { margin-top: 10px; }',
    '    .category { display: inline-block; background: #e9ecef; padding: 4px 10px; border-radius: 4px; font-size: 12px; margin-right: 6px; }',
    '    footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e9ecef; text-align: center; color: #6c757d; font-size: 14px; }',
    '  </style>',
    '</head>',
    '<body>',
    '  <header>',
    '    <h1>📚 AI Web Feeds Archive</h1>',
    `    <div class="stats">Exported: ${new Date().toLocaleString()} | ${
      allArticles.length
    } articles | ${allFeeds.length} feeds</div>`,
    '  </header>',
    '',
    '  <div class="search">',
    '    <input type="text" id="searchInput" placeholder="Search articles..." />',
    '  </div>',
    '',
    '  <div class="filters">',
    '    <button class="filter-btn active" data-filter="all">All</button>',
    '    <button class="filter-btn" data-filter="unread">Unread</button>',
    '    <button class="filter-btn" data-filter="starred">Starred</button>',
    '    <button class="filter-btn" data-filter="archived">Archived</button>',
    '  </div>',
    '',
    '  <div id="articles">',
  ];

  // Add articles
  allArticles
    .sort((a, b) => b.pubDate - a.pubDate)
    .forEach((article) => {
      const badges = [];
      if (article.read) badges.push('<span class="badge badge-read">✓ Read</span>');
      if (article.starred) badges.push('<span class="badge badge-starred">★ Starred</span>');
      if (article.archived) badges.push('<span class="badge badge-archived">📦 Archived</span>');

      const dataAttrs = [
        article.read ? 'data-read="true"' : '',
        article.starred ? 'data-starred="true"' : '',
        article.archived ? 'data-archived="true"' : '',
      ]
        .filter(Boolean)
        .join(' ');

      html.push(`    <div class="article" ${dataAttrs}>`);
      html.push('      <div class="article-header">');
      html.push('        <div>');
      html.push(
        `          <div class="article-title"><a href="${escapeHtml(article.link)}" target="_blank">${escapeHtml(
          article.title
        )}</a></div>`
      );
      html.push(
        `          <div class="article-meta">${new Date(article.pubDate).toLocaleDateString()} ${
          article.author ? `| ${escapeHtml(article.author)}` : ''
        } ${article.readingTime ? `| ${article.readingTime} min read` : ''}</div>`
      );
      html.push('        </div>');
      if (badges.length > 0) {
        html.push(`        <div class="article-badges">${badges.join('')}</div>`);
      }
      html.push('      </div>');

      if (article.summary) {
        html.push(`      <div class="article-content">${escapeHtml(article.summary)}</div>`);
      }

      if (article.categories.length > 0) {
        html.push('      <div class="categories">');
        article.categories.forEach((cat) => {
          html.push(`        <span class="category">${escapeHtml(cat)}</span>`);
        });
        html.push('      </div>');
      }

      html.push('    </div>');
    });

  html.push('  </div>');
  html.push('');
  html.push('  <footer>');
  html.push('    <p>Generated by AI Web Feeds | Static HTML Archive</p>');
  html.push('    <p>This is an offline archive. All functionality works without internet connection.</p>');
  html.push('  </footer>');
  html.push('');
  html.push('  <script>');
  html.push('    // Search functionality');
  html.push('    const searchInput = document.getElementById("searchInput");');
  html.push('    const articles = document.querySelectorAll(".article");');
  html.push('');
  html.push('    searchInput.addEventListener("input", (e) => {');
  html.push('      const query = e.target.value.toLowerCase();');
  html.push('      articles.forEach((article) => {');
  html.push('        const text = article.textContent.toLowerCase();');
  html.push('        article.classList.toggle("hidden", !text.includes(query));');
  html.push('      });');
  html.push('    });');
  html.push('');
  html.push('    // Filter functionality');
  html.push('    const filterBtns = document.querySelectorAll(".filter-btn");');
  html.push('    filterBtns.forEach((btn) => {');
  html.push('      btn.addEventListener("click", () => {');
  html.push('        filterBtns.forEach((b) => b.classList.remove("active"));');
  html.push('        btn.classList.add("active");');
  html.push('');
  html.push('        const filter = btn.dataset.filter;');
  html.push('        articles.forEach((article) => {');
  html.push('          if (filter === "all") {');
  html.push('            article.classList.remove("hidden");');
  html.push('          } else if (filter === "unread") {');
  html.push('            article.classList.toggle("hidden", article.dataset.read === "true");');
  html.push('          } else if (filter === "starred") {');
  html.push('            article.classList.toggle("hidden", !article.dataset.starred);');
  html.push('          } else if (filter === "archived") {');
  html.push('            article.classList.toggle("hidden", !article.dataset.archived);');
  html.push('          }');
  html.push('        });');
  html.push('      });');
  html.push('    });');
  html.push('  </script>');
  html.push('</body>');
  html.push('</html>');

  return new Blob([html.join('\n')], { type: 'text/html' });
}

/**
 * Download blob as file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export with automatic filename
 */
export async function exportData(format: 'json' | 'csv' | 'opml' | 'html'): Promise<void> {
  const timestamp = new Date().toISOString().split('T')[0];

  let blob: Blob;
  let filename: string;

  switch (format) {
    case 'json':
      blob = await exportJSON();
      filename = `aiwebfeeds-backup-${timestamp}.json`;
      break;
    case 'csv':
      blob = await exportCSV();
      filename = `aiwebfeeds-articles-${timestamp}.csv`;
      break;
    case 'opml':
      blob = await exportOPML();
      filename = `aiwebfeeds-feeds-${timestamp}.opml`;
      break;
    case 'html':
      blob = await exportHTML();
      filename = `aiwebfeeds-archive-${timestamp}.html`;
      break;
  }

  downloadBlob(blob, filename);
}

// ============================================================================
// Helper Functions
// ============================================================================

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


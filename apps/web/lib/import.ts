/**
 * Data Import Utilities
 *
 * Import data from various formats:
 * - JSON: Restore complete backup
 * - OPML: Import feed subscriptions
 *
 * All imports processed client-side, no backend required
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

export interface ImportResult {
  success: boolean;
  counts: {
    articles?: number;
    feeds?: number;
    folders?: number;
    readingHistory?: number;
    annotations?: number;
  };
  errors: string[];
}

export interface ImportOptions {
  mergeStrategy?: 'replace' | 'merge' | 'skip';
  validateData?: boolean;
}

/**
 * Import from JSON backup
 */
export async function importJSON(
  file: File,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const { mergeStrategy = 'merge', validateData = true } = options;
  const errors: string[] = [];

  try {
    // Read file
    const text = await file.text();
    const data = JSON.parse(text);

    // Validate structure
    if (validateData && !isValidExportData(data)) {
      return {
        success: false,
        counts: {},
        errors: ['Invalid JSON format. File may be corrupted.'],
      };
    }

    const counts = {
      articles: 0,
      feeds: 0,
      folders: 0,
      readingHistory: 0,
      annotations: 0,
    };

    // Import feeds first (dependencies)
    if (data.feeds && Array.isArray(data.feeds)) {
      for (const feed of data.feeds) {
        try {
          if (mergeStrategy === 'replace' || !(await feeds.get(feed.id))) {
            await feeds.put(feed);
            counts.feeds++;
          }
        } catch (error) {
          errors.push(`Failed to import feed ${feed.title}: ${error}`);
        }
      }
    }

    // Import folders
    if (data.folders && Array.isArray(data.folders)) {
      for (const folder of data.folders) {
        try {
          if (mergeStrategy === 'replace' || !(await folders.get(folder.id))) {
            await folders.put(folder);
            counts.folders++;
          }
        } catch (error) {
          errors.push(`Failed to import folder ${folder.name}: ${error}`);
        }
      }
    }

    // Import articles
    if (data.articles && Array.isArray(data.articles)) {
      for (const article of data.articles) {
        try {
          if (mergeStrategy === 'replace' || !(await articles.get(article.id))) {
            await articles.put(article);
            counts.articles++;
          }
        } catch (error) {
          errors.push(`Failed to import article ${article.title}: ${error}`);
        }
      }
    }

    // Import reading history
    if (data.readingHistory && Array.isArray(data.readingHistory)) {
      for (const entry of data.readingHistory) {
        try {
          if (mergeStrategy === 'replace' || !(await readingHistory.get(entry.id))) {
            await readingHistory.put(entry);
            counts.readingHistory++;
          }
        } catch (error) {
          errors.push(`Failed to import reading history: ${error}`);
        }
      }
    }

    // Import annotations
    if (data.annotations && Array.isArray(data.annotations)) {
      for (const annotation of data.annotations) {
        try {
          if (mergeStrategy === 'replace' || !(await annotations.get(annotation.id))) {
            await annotations.put(annotation);
            counts.annotations++;
          }
        } catch (error) {
          errors.push(`Failed to import annotation: ${error}`);
        }
      }
    }

    // Import preferences (always replace)
    if (data.preferences && mergeStrategy === 'replace') {
      try {
        await preferences.put(data.preferences);
      } catch (error) {
        errors.push(`Failed to import preferences: ${error}`);
      }
    }

    return {
      success: errors.length === 0,
      counts,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      counts: {},
      errors: [`Failed to parse JSON: ${error}`],
    };
  }
}

/**
 * Import feeds from OPML
 */
export async function importOPML(file: File): Promise<ImportResult> {
  const errors: string[] = [];
  let feedCount = 0;
  let folderCount = 0;

  try {
    const text = await file.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');

    // Check for parsing errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      return {
        success: false,
        counts: {},
        errors: ['Invalid OPML format. File may be corrupted.'],
      };
    }

    // Get all outline elements
    const outlines = doc.querySelectorAll('outline');

    for (const outline of outlines) {
      const type = outline.getAttribute('type');

      // Feed outline (has xmlUrl)
      if (type === 'rss' || type === 'feed' || outline.hasAttribute('xmlUrl')) {
        try {
          const feed: Feed = {
            id: generateId(),
            url: outline.getAttribute('xmlUrl') || '',
            title: outline.getAttribute('title') || outline.getAttribute('text') || 'Untitled Feed',
            description: outline.getAttribute('description') || undefined,
            link: outline.getAttribute('htmlUrl') || undefined,
            lastSync: 0,
            syncInterval: 60, // 1 hour default
            enabled: true,
            unreadCount: 0,
            errorCount: 0,
            metadata: {},
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          // Check if feed already exists
          const existing = (await feeds.getAll()).find((f) => f.url === feed.url);
          if (!existing) {
            await feeds.put(feed);
            feedCount++;
          }
        } catch (error) {
          errors.push(`Failed to import feed: ${error}`);
        }
      }
      // Folder outline (has child feeds)
      else if (outline.children.length > 0) {
        try {
          const folder: Folder = {
            id: generateId(),
            name: outline.getAttribute('title') || outline.getAttribute('text') || 'Untitled Folder',
            position: folderCount,
            collapsed: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          await folders.put(folder);
          folderCount++;

          // Import feeds in this folder
          const feedOutlines = outline.querySelectorAll('outline[type="rss"], outline[xmlUrl]');
          for (const feedOutline of feedOutlines) {
            try {
              const feed: Feed = {
                id: generateId(),
                url: feedOutline.getAttribute('xmlUrl') || '',
                title:
                  feedOutline.getAttribute('title') ||
                  feedOutline.getAttribute('text') ||
                  'Untitled Feed',
                description: feedOutline.getAttribute('description') || undefined,
                link: feedOutline.getAttribute('htmlUrl') || undefined,
                folderId: folder.id,
                lastSync: 0,
                syncInterval: 60,
                enabled: true,
                unreadCount: 0,
                errorCount: 0,
                metadata: {},
                createdAt: Date.now(),
                updatedAt: Date.now(),
              };

              const existing = (await feeds.getAll()).find((f) => f.url === feed.url);
              if (!existing) {
                await feeds.put(feed);
                feedCount++;
              }
            } catch (error) {
              errors.push(`Failed to import feed in folder: ${error}`);
            }
          }
        } catch (error) {
          errors.push(`Failed to import folder: ${error}`);
        }
      }
    }

    return {
      success: errors.length === 0,
      counts: {
        feeds: feedCount,
        folders: folderCount,
      },
      errors,
    };
  } catch (error) {
    return {
      success: false,
      counts: {},
      errors: [`Failed to parse OPML: ${error}`],
    };
  }
}

/**
 * Read file and detect format
 */
export async function detectFileFormat(file: File): Promise<'json' | 'opml' | 'unknown'> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.json')) return 'json';
  if (name.endsWith('.opml') || name.endsWith('.xml')) return 'opml';

  // Try to detect by content
  try {
    const sample = await file.slice(0, 1000).text();
    if (sample.includes('<?xml') && sample.includes('<opml')) return 'opml';
    if (sample.trim().startsWith('{')) return 'json';
  } catch {
    // Ignore errors
  }

  return 'unknown';
}

/**
 * Import file (auto-detect format)
 */
export async function importFile(
  file: File,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const format = await detectFileFormat(file);

  switch (format) {
    case 'json':
      return importJSON(file, options);
    case 'opml':
      return importOPML(file);
    default:
      return {
        success: false,
        counts: {},
        errors: ['Unknown file format. Please use JSON or OPML files.'],
      };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate export data structure
 */
function isValidExportData(data: any): boolean {
  return (
    data &&
    typeof data === 'object' &&
    'version' in data &&
    'exportedAt' in data &&
    ('articles' in data || 'feeds' in data || 'folders' in data)
  );
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * React hook for file import
 */
import { useState } from 'react';

export function useFileImport() {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const importFromFile = async (file: File, options?: ImportOptions) => {
    setImporting(true);
    setResult(null);

    try {
      const importResult = await importFile(file, options);
      setResult(importResult);
      return importResult;
    } catch (error) {
      const errorResult: ImportResult = {
        success: false,
        counts: {},
        errors: [`Import failed: ${error}`],
      };
      setResult(errorResult);
      return errorResult;
    } finally {
      setImporting(false);
    }
  };

  return {
    importing,
    result,
    importFromFile,
    clearResult: () => setResult(null),
  };
}

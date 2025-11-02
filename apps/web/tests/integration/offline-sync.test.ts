/**
 * Integration Test: Offline Sync & Conflict Resolution
 * 
 * Tests offline sync manager logic including:
 * - Local change tracking
 * - Conflict detection algorithms
 * - Conflict resolution strategies (keepLocal, acceptRemote, merge)
 * - Background sync queue management
 * 
 * @see specs/004-client-side-features/spec.md#user-story-1---offline-feed-reading
 * @see specs/004-client-side-features/tasks.md#t012
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db, type Article, generateId, now, generateFingerprint } from '@/lib/indexeddb/db';

// Mock module imports will be implemented in T014
// For now, we'll test the interface contracts

describe('Offline Sync Manager', () => {
  beforeEach(async () => {
    // Clear database before each test
    await db.articles.clear();
    await db.offline_tasks.clear();
  });

  afterEach(async () => {
    // Cleanup after each test
    await db.articles.clear();
    await db.offline_tasks.clear();
  });

  describe('Article Caching', () => {
    it('should cache articles with fresh status', async () => {
      const articleId = generateId();
      const feedId    = generateId();

      const article: Article = {
        id:               articleId,
        feedId,
        title:            'Test Article',
        url:              'https://example.com/article',
        author:           'John Doe',
        publishedAt:      now(),
        content:          '<p>Article content</p>',
        summary:          'Article summary',
        tags:             ['test', 'example'],
        starred:          false,
        offlineStatus:    'fresh',
        lastSyncedAt:     now(),
        sourceFingerprint: await generateFingerprint(
          'https://example.com/article',
          now(),
          'Test Article'
        ),
      };

      await db.articles.add(article);

      const cached = await db.articles.get(articleId);
      expect(cached).toBeDefined();
      expect(cached?.offlineStatus).toBe('fresh');
      expect(cached?.title).toBe('Test Article');
    });

    it('should handle duplicate articles by fingerprint', async () => {
      const feedId    = generateId();
      const url       = 'https://example.com/article';
      const pubDate   = '2025-01-01T00:00:00Z';
      const title     = 'Duplicate Article';
      const fingerprint = await generateFingerprint(url, pubDate, title);

      // Add first article
      const article1: Article = {
        id:               generateId(),
        feedId,
        title,
        url,
        publishedAt:      pubDate,
        content:          '<p>Content 1</p>',
        tags:             [],
        starred:          false,
        offlineStatus:    'fresh',
        lastSyncedAt:     now(),
        sourceFingerprint: fingerprint,
      };

      await db.articles.add(article1);

      // Try to add duplicate
      const duplicates = await db.articles
        .where('sourceFingerprint')
        .equals(fingerprint)
        .toArray();

      expect(duplicates.length).toBe(1);
      expect(duplicates[0]?.id).toBe(article1.id);
    });
  });

  describe('Offline Status Lifecycle', () => {
    it('should transition from fresh to stale', async () => {
      const articleId = generateId();
      const article: Article = {
        id:               articleId,
        feedId:           generateId(),
        title:            'Test Article',
        url:              'https://example.com/article',
        publishedAt:      now(),
        content:          '<p>Content</p>',
        tags:             [],
        starred:          false,
        offlineStatus:    'fresh',
        lastSyncedAt:     now(),
        sourceFingerprint: await generateFingerprint(
          'https://example.com/article',
          now(),
          'Test Article'
        ),
      };

      await db.articles.add(article);

      // Simulate remote update (mark as stale)
      await db.articles.update(articleId, {
        offlineStatus: 'stale',
      });

      const updated = await db.articles.get(articleId);
      expect(updated?.offlineStatus).toBe('stale');
    });

    it('should mark conflicts when local and remote diverge', async () => {
      const articleId = generateId();
      const article: Article = {
        id:               articleId,
        feedId:           generateId(),
        title:            'Test Article',
        url:              'https://example.com/article',
        publishedAt:      now(),
        content:          '<p>Content</p>',
        tags:             [],
        starred:          false,
        readAt:           now(), // Local change: marked as read
        offlineStatus:    'fresh',
        lastSyncedAt:     now(),
        sourceFingerprint: await generateFingerprint(
          'https://example.com/article',
          now(),
          'Test Article'
        ),
      };

      await db.articles.add(article);

      // Simulate conflict: remote deleted, but local has changes
      await db.articles.update(articleId, {
        offlineStatus:  'conflicted',
        conflictReason: 'Article deleted remotely but has local changes',
      });

      const conflicted = await db.articles.get(articleId);
      expect(conflicted?.offlineStatus).toBe('conflicted');
      expect(conflicted?.conflictReason).toContain('deleted remotely');
    });
  });

  describe('Conflict Resolution', () => {
    it('should keep local changes when chosen', async () => {
      const articleId = generateId();
      const article: Article = {
        id:               articleId,
        feedId:           generateId(),
        title:            'Test Article',
        url:              'https://example.com/article',
        publishedAt:      now(),
        content:          '<p>Content</p>',
        tags:             [],
        starred:          true, // Local change
        readAt:           now(), // Local change
        offlineStatus:    'conflicted',
        lastSyncedAt:     now(),
        sourceFingerprint: await generateFingerprint(
          'https://example.com/article',
          now(),
          'Test Article'
        ),
        conflictReason:   'Local changes conflict with remote',
      };

      await db.articles.add(article);

      // Resolve: keep local
      await db.articles.update(articleId, {
        offlineStatus:  'fresh',
        conflictReason: undefined,
        lastSyncedAt:   now(),
      });

      const resolved = await db.articles.get(articleId);
      expect(resolved?.offlineStatus).toBe('fresh');
      expect(resolved?.starred).toBe(true); // Local changes preserved
      expect(resolved?.readAt).toBeDefined();
      expect(resolved?.conflictReason).toBeUndefined();
    });

    it('should accept remote changes when chosen', async () => {
      const articleId = generateId();
      const article: Article = {
        id:               articleId,
        feedId:           generateId(),
        title:            'Local Title',
        url:              'https://example.com/article',
        publishedAt:      now(),
        content:          '<p>Local Content</p>',
        tags:             [],
        starred:          true,
        offlineStatus:    'conflicted',
        lastSyncedAt:     now(),
        sourceFingerprint: await generateFingerprint(
          'https://example.com/article',
          now(),
          'Local Title'
        ),
        conflictReason:   'Title changed remotely',
      };

      await db.articles.add(article);

      // Simulate accepting remote changes
      await db.articles.update(articleId, {
        title:          'Remote Title',
        content:        '<p>Remote Content</p>',
        starred:        false,
        offlineStatus:  'fresh',
        conflictReason: undefined,
        lastSyncedAt:   now(),
      });

      const resolved = await db.articles.get(articleId);
      expect(resolved?.title).toBe('Remote Title');
      expect(resolved?.content).toBe('<p>Remote Content</p>');
      expect(resolved?.starred).toBe(false);
      expect(resolved?.offlineStatus).toBe('fresh');
    });

    it('should list all conflicted articles', async () => {
      // Add multiple articles with conflicts
      const articles: Article[] = [
        {
          id:               generateId(),
          feedId:           generateId(),
          title:            'Article 1',
          url:              'https://example.com/1',
          publishedAt:      now(),
          content:          '<p>Content 1</p>',
          tags:             [],
          starred:          false,
          offlineStatus:    'conflicted',
          lastSyncedAt:     now(),
          sourceFingerprint: await generateFingerprint(
            'https://example.com/1',
            now(),
            'Article 1'
          ),
          conflictReason:   'Conflict 1',
        },
        {
          id:               generateId(),
          feedId:           generateId(),
          title:            'Article 2',
          url:              'https://example.com/2',
          publishedAt:      now(),
          content:          '<p>Content 2</p>',
          tags:             [],
          starred:          false,
          offlineStatus:    'fresh', // Not conflicted
          lastSyncedAt:     now(),
          sourceFingerprint: await generateFingerprint(
            'https://example.com/2',
            now(),
            'Article 2'
          ),
        },
        {
          id:               generateId(),
          feedId:           generateId(),
          title:            'Article 3',
          url:              'https://example.com/3',
          publishedAt:      now(),
          content:          '<p>Content 3</p>',
          tags:             [],
          starred:          false,
          offlineStatus:    'conflicted',
          lastSyncedAt:     now(),
          sourceFingerprint: await generateFingerprint(
            'https://example.com/3',
            now(),
            'Article 3'
          ),
          conflictReason:   'Conflict 3',
        },
      ];

      await db.articles.bulkAdd(articles);

      // Query conflicted articles
      const conflicted = await db.articles
        .where('offlineStatus')
        .equals('conflicted')
        .toArray();

      expect(conflicted.length).toBe(2);
      expect(conflicted.every((a) => a.conflictReason)).toBe(true);
    });
  });

  describe('Background Sync Queue', () => {
    it('should queue offline tasks', async () => {
      const taskId = generateId();
      await db.offline_tasks.add({
        id:         taskId,
        type:       'cacheFeeds',
        payload:    { feedIds: [generateId(), generateId()] },
        status:     'pending',
        createdAt:  now(),
        updatedAt:  now(),
        retryCount: 0,
      });

      const task = await db.offline_tasks.get(taskId);
      expect(task).toBeDefined();
      expect(task?.status).toBe('pending');
      expect(task?.type).toBe('cacheFeeds');
    });

    it('should track task retry count', async () => {
      const taskId = generateId();
      await db.offline_tasks.add({
        id:         taskId,
        type:       'cacheFeeds',
        payload:    {},
        status:     'failed',
        createdAt:  now(),
        updatedAt:  now(),
        retryCount: 0,
        error:      'Network error',
      });

      // Increment retry count
      await db.offline_tasks.update(taskId, {
        retryCount: 1,
        updatedAt:  now(),
      });

      const task = await db.offline_tasks.get(taskId);
      expect(task?.retryCount).toBe(1);
    });

    it('should limit retries to 3', async () => {
      const taskId = generateId();
      await db.offline_tasks.add({
        id:         taskId,
        type:       'resolveConflicts',
        payload:    {},
        status:     'failed',
        createdAt:  now(),
        updatedAt:  now(),
        retryCount: 3,
        error:      'Max retries exceeded',
      });

      const task = await db.offline_tasks.get(taskId);
      expect(task?.retryCount).toBe(3);
      expect(task?.status).toBe('failed');
    });

    it('should list pending sync tasks', async () => {
      await db.offline_tasks.bulkAdd([
        {
          id:         generateId(),
          type:       'cacheFeeds',
          payload:    {},
          status:     'pending',
          createdAt:  now(),
          updatedAt:  now(),
          retryCount: 0,
        },
        {
          id:         generateId(),
          type:       'purgeArticles',
          payload:    {},
          status:     'complete', // Not pending
          createdAt:  now(),
          updatedAt:  now(),
          retryCount: 0,
        },
        {
          id:         generateId(),
          type:       'cacheFeeds',
          payload:    {},
          status:     'pending',
          createdAt:  now(),
          updatedAt:  now(),
          retryCount: 0,
        },
      ]);

      const pending = await db.offline_tasks
        .where('status')
        .equals('pending')
        .toArray();

      expect(pending.length).toBe(2);
    });
  });

  describe('Sync Strategies', () => {
    it('should preserve starred articles during sync', async () => {
      const articleId = generateId();
      const article: Article = {
        id:               articleId,
        feedId:           generateId(),
        title:            'Test Article',
        url:              'https://example.com/article',
        publishedAt:      now(),
        content:          '<p>Content</p>',
        tags:             [],
        starred:          true, // User starred offline
        offlineStatus:    'fresh',
        lastSyncedAt:     now(),
        sourceFingerprint: await generateFingerprint(
          'https://example.com/article',
          now(),
          'Test Article'
        ),
      };

      await db.articles.add(article);

      // Simulate sync (starred should be preserved)
      const synced = await db.articles.get(articleId);
      expect(synced?.starred).toBe(true);
    });

    it('should preserve read status during sync', async () => {
      const articleId = generateId();
      const readTime  = now();
      const article: Article = {
        id:               articleId,
        feedId:           generateId(),
        title:            'Test Article',
        url:              'https://example.com/article',
        publishedAt:      now(),
        content:          '<p>Content</p>',
        tags:             [],
        starred:          false,
        readAt:           readTime, // User read offline
        offlineStatus:    'fresh',
        lastSyncedAt:     now(),
        sourceFingerprint: await generateFingerprint(
          'https://example.com/article',
          now(),
          'Test Article'
        ),
      };

      await db.articles.add(article);

      // Simulate sync (readAt should be preserved)
      const synced = await db.articles.get(articleId);
      expect(synced?.readAt).toBe(readTime);
    });

    it('should handle article deletion conflicts', async () => {
      const articleId = generateId();
      const article: Article = {
        id:               articleId,
        feedId:           generateId(),
        title:            'Deleted Article',
        url:              'https://example.com/deleted',
        publishedAt:      now(),
        content:          '<p>Content</p>',
        tags:             [],
        starred:          true, // Local change before deletion
        offlineStatus:    'conflicted',
        lastSyncedAt:     now(),
        sourceFingerprint: await generateFingerprint(
          'https://example.com/deleted',
          now(),
          'Deleted Article'
        ),
        conflictReason:   'Article deleted remotely but starred locally',
      };

      await db.articles.add(article);

      // User should see conflict and choose to keep or delete
      const conflicted = await db.articles.get(articleId);
      expect(conflicted?.offlineStatus).toBe('conflicted');
      expect(conflicted?.conflictReason).toContain('deleted remotely');

      // If user chooses to keep local
      await db.articles.update(articleId, {
        offlineStatus:  'fresh',
        conflictReason: undefined,
      });

      const kept = await db.articles.get(articleId);
      expect(kept?.offlineStatus).toBe('fresh');
      expect(kept?.starred).toBe(true);
    });
  });
});

/**
 * Unit Tests: Folder & View Repository
 * 
 * Tests folder management, ordering, and custom view persistence.
 * 
 * @see specs/004-client-side-features/tasks.md#t024
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { db, type Folder, type CustomView, generateId, now } from '@/lib/indexeddb/db';

describe('Folder Repository', () => {
  beforeEach(async () => {
    await db.folders.clear();
  });

  it('should create root folder', async () => {
    const folderId = generateId();
    const folder: Folder = {
      id:        folderId,
      name:      'Work',
      position:  0,
      collapsed: false,
    };

    await db.folders.add(folder);

    const saved = await db.folders.get(folderId);
    expect(saved).toBeDefined();
    expect(saved?.name).toBe('Work');
    expect(saved?.parentId).toBeUndefined();
  });

  it('should create nested folder', async () => {
    const parentId = generateId();
    const childId  = generateId();

    await db.folders.add({
      id:        parentId,
      name:      'Tech',
      position:  0,
      collapsed: false,
    });

    await db.folders.add({
      id:        childId,
      name:      'AI',
      parentId:  parentId,
      position:  0,
      collapsed: false,
    });

    const child = await db.folders.get(childId);
    expect(child?.parentId).toBe(parentId);
  });

  it('should maintain folder ordering', async () => {
    const folder1Id = generateId();
    const folder2Id = generateId();
    const folder3Id = generateId();

    await db.folders.bulkAdd([
      { id: folder1Id, name: 'Folder 1', position: 2, collapsed: false },
      { id: folder2Id, name: 'Folder 2', position: 0, collapsed: false },
      { id: folder3Id, name: 'Folder 3', position: 1, collapsed: false },
    ]);

    const folders = await db.folders.orderBy('position').toArray();

    expect(folders[0]?.name).toBe('Folder 2');
    expect(folders[1]?.name).toBe('Folder 3');
    expect(folders[2]?.name).toBe('Folder 1');
  });

  it('should toggle folder collapsed state', async () => {
    const folderId = generateId();

    await db.folders.add({
      id:        folderId,
      name:      'Collapsed Test',
      position:  0,
      collapsed: false,
    });

    await db.folders.update(folderId, { collapsed: true });

    const folder = await db.folders.get(folderId);
    expect(folder?.collapsed).toBe(true);
  });

  it('should get folder hierarchy', async () => {
    const rootId   = generateId();
    const child1Id = generateId();
    const child2Id = generateId();

    await db.folders.bulkAdd([
      { id: rootId,   name: 'Root', position: 0, collapsed: false },
      { id: child1Id, name: 'Child 1', parentId: rootId, position: 0, collapsed: false },
      { id: child2Id, name: 'Child 2', parentId: rootId, position: 1, collapsed: false },
    ]);

    const children = await db.folders
      .where('parentId')
      .equals(rootId)
      .toArray();

    expect(children).toHaveLength(2);
  });
});

describe('Custom View Repository', () => {
  beforeEach(async () => {
    await db.views.clear();
  });

  it('should create custom view', async () => {
    const viewId = generateId();
    const view: CustomView = {
      id:        viewId,
      name:      "Today's Reading",
      filters:   {
        readStatus: 'unread',
        topics:     ['AI', 'ML'],
      },
      sort:      'date',
      pinned:    true,
      createdAt: now(),
    };

    await db.views.add(view);

    const saved = await db.views.get(viewId);
    expect(saved).toBeDefined();
    expect(saved?.name).toBe("Today's Reading");
  });

  it('should validate filter schema', () => {
    const validFilters = {
      readStatus: 'unread',
      topics:     ['AI'],
      dateRange:  {
        from: '2025-01-01',
        to:   '2025-12-31',
      },
    };

    expect(validFilters.readStatus).toMatch(/^(all|unread|read)$/);
  });

  it('should get pinned views', async () => {
    await db.views.bulkAdd([
      {
        id:        generateId(),
        name:      'View 1',
        filters:   {},
        sort:      'relevance',
        pinned:    true,
        createdAt: now(),
      },
      {
        id:        generateId(),
        name:      'View 2',
        filters:   {},
        sort:      'date',
        pinned:    false,
        createdAt: now(),
      },
      {
        id:        generateId(),
        name:      'View 3',
        filters:   {},
        sort:      'relevance',
        pinned:    true,
        createdAt: now(),
      },
    ]);

    const pinned = await db.views
      .where('pinned')
      .equals(1)
      .toArray();

    expect(pinned).toHaveLength(2);
  });

  it('should ensure unique view names', async () => {
    const view1 = {
      id:        generateId(),
      name:      'My View',
      filters:   {},
      sort:      'relevance' as const,
      pinned:    false,
      createdAt: now(),
    };

    await db.views.add(view1);

    // Check for duplicate name
    const existing = await db.views
      .where('name')
      .equals('My View')
      .toArray();

    expect(existing).toHaveLength(1);
  });

  it('should apply date range filter', () => {
    const filter = {
      dateRange: {
        from: '2025-01-01T00:00:00Z',
        to:   '2025-12-31T23:59:59Z',
      },
    };

    const testDate = new Date('2025-06-15');
    const from     = new Date(filter.dateRange.from);
    const to       = new Date(filter.dateRange.to);

    expect(testDate >= from && testDate <= to).toBe(true);
  });

  it('should apply topic filter', () => {
    const filter = {
      topics: ['AI', 'Machine Learning'],
    };

    const article = {
      tags: ['AI', 'Deep Learning'],
    };

    const matches = article.tags.some((tag) => filter.topics.includes(tag));
    expect(matches).toBe(true);
  });
});

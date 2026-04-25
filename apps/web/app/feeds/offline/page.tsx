/**
 * Offline Feed View
 * 
 * Displays cached feeds and articles available for offline reading.
 * Shows offline status badge, last sync timestamp, and article list.
 * 
 * @see specs/004-client-side-features/spec.md#user-story-1---offline-feed-reading
 * @see specs/004-client-side-features/tasks.md#t015
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Article } from '@/lib/indexeddb/db';
import { formatDistanceToNow } from '@/lib/utils/date-format';

export default function OfflineFeedPage(): JSX.Element {
  const [isOffline, setIsOffline] = useState(false);

  // Load cached articles
  const articles = useLiveQuery(() => db.articles.toArray(), []);

  // Monitor online/offline status
  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOffline(!navigator.onLine);
    };

    updateOnlineStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  // Get last sync time
  const lastSyncTime = articles?.[0]?.lastSyncedAt
    ? new Date(articles[0].lastSyncedAt)
    : new Date();

  return (
    <div className="container mx-auto max-w-4xl p-6">
      {/* Offline Status Badge */}
      {isOffline && (
        <div
          className="mb-6 rounded-lg bg-amber-50 p-4 text-amber-900 border border-amber-200"
          data-testid="offline-mode-indicator"
        >
          <div className="flex items-center gap-2">
            <span className="text-2xl">📱</span>
            <div>
              <h3 className="font-semibold">Offline Mode</h3>
              <p className="text-sm text-amber-700">
                Showing cached articles. Changes will sync when you're back online.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Offline Feeds</h1>
        <p className="mt-2 text-gray-600">
          Articles cached for offline reading
        </p>

        {/* Last Sync Timestamp */}
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <span>Last synced:</span>
          <span data-testid="last-sync-timestamp" className="font-medium">
            {formatDistanceToNow(lastSyncTime)} ago
          </span>
        </div>
      </div>

      {/* Article List */}
      <div className="space-y-4">
        {!articles || articles.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              No Offline Articles
            </h2>
            <p className="text-gray-500">
              Save feeds for offline reading to see them here
            </p>
          </div>
        ) : (
          articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Article Card Component
 */
function ArticleCard({ article }: { article: Article }): JSX.Element {
  const [starred, setStarred] = useState(article.starred);
  const [isRead, setIsRead] = useState(!!article.readAt);

  const handleStar = async () => {
    const newStarred = !starred;
    setStarred(newStarred);

    await db.articles.update(article.id, {
      starred: newStarred,
    });
  };

  const handleMarkRead = async () => {
    const now = new Date().toISOString();
    setIsRead(true);

    await db.articles.update(article.id, {
      readAt: now,
    });
  };

  return (
    <div
      className="rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors"
      data-testid="article-item"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {/* Article Title */}
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {article.title}
          </h3>

          {/* Summary */}
          {article.summary && (
            <p className="text-sm text-gray-600 mb-2 line-clamp-2">
              {article.summary}
            </p>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            {article.author && <span>{article.author}</span>}
            <span>
              {new Date(article.publishedAt).toLocaleDateString()}
            </span>
            {article.tags.length > 0 && (
              <div className="flex gap-1">
                {article.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-gray-100 px-2 py-0.5"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Offline Status Indicator */}
          {article.offlineStatus === 'conflicted' && (
            <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
              <span>⚠️</span>
              <span>Sync Conflict</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {/* Star Button */}
          <button
            onClick={handleStar}
            className="rounded p-2 hover:bg-gray-100"
            data-testid="star-button"
            title={starred ? 'Unstar' : 'Star'}
          >
            <span className="text-xl">
              {starred ? '⭐' : '☆'}
            </span>
          </button>

          {/* Mark as Read Button */}
          {!isRead && (
            <button
              onClick={handleMarkRead}
              className="rounded p-2 hover:bg-gray-100 text-xs"
              data-testid="mark-as-read-button"
              title="Mark as read"
            >
              ✓
            </button>
          )}

          {/* Read Indicator */}
          {isRead && (
            <div
              className="text-green-600 text-xs"
              data-testid="read-indicator"
            >
              ✓ Read
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

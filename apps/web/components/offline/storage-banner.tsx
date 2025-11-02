/**
 * Storage Warning Banner
 * 
 * Displays storage usage warnings when approaching quota limits.
 * Shows at 70% (info), 80% (warning), 90% (blocked) thresholds.
 * Provides cleanup tools when storage is high.
 * 
 * @see specs/004-client-side-features/spec.md#storage-quota-management
 * @see specs/004-client-side-features/tasks.md#t016
 */

'use client';

import React, { useEffect, useState } from 'react';
import { quotaMonitor, formatBytes, type QuotaStatus } from '@/lib/storage/quota-monitor';
import { db } from '@/lib/indexeddb/db';
import { offlineSyncManager } from '@/lib/indexeddb/offline-sync';

export function StorageBanner(): JSX.Element {
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [showCleanup, setShowCleanup] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  useEffect(() => {
    // Start monitoring
    quotaMonitor.start();

    // Listen for threshold events
    const handleThreshold = (status: QuotaStatus) => {
      setQuotaStatus(status);
    };

    quotaMonitor.on('threshold', handleThreshold);

    // Check initial status
    quotaMonitor.checkQuota().then(setQuotaStatus);

    return () => {
      quotaMonitor.off('threshold', handleThreshold);
      quotaMonitor.stop();
    };
  }, []);

  const handleDeleteOldArticles = async () => {
    setIsCleaningUp(true);
    try {
      const deleted = await offlineSyncManager.purgeOldArticles(90);
      alert(`Deleted ${deleted} old articles`);

      // Refresh quota status
      const newStatus = await quotaMonitor.checkQuota();
      setQuotaStatus(newStatus);
    } catch (error) {
      console.error('Failed to delete old articles:', error);
      alert('Failed to delete old articles');
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleClearCache = async () => {
    if (!confirm('Clear all cached data? This cannot be undone.')) {
      return;
    }

    setIsCleaningUp(true);
    try {
      await db.articles.clear();
      await db.annotations.clear();
      await db.reading_history.clear();

      // Clear service worker caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }

      alert('Cache cleared successfully');

      // Refresh quota status
      const newStatus = await quotaMonitor.checkQuota();
      setQuotaStatus(newStatus);
    } catch (error) {
      console.error('Failed to clear cache:', error);
      alert('Failed to clear cache');
    } finally {
      setIsCleaningUp(false);
      setShowCleanup(false);
    }
  };

  // Don't show banner if storage is normal
  if (!quotaStatus || quotaStatus.level === 'normal') {
    return <></>;
  }

  const levelColors = {
    info:    { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-900',   button: 'text-blue-600'   },
    warning: { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-900',  button: 'text-amber-600'  },
    blocked: { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-900',    button: 'text-red-600'    },
  };

  const colors = levelColors[quotaStatus.level];

  return (
    <>
      {/* Storage Warning Banner */}
      <div
        className={`${colors.bg} ${colors.border} ${colors.text} border rounded-lg p-4 mb-6`}
        data-testid="storage-warning-banner"
        onClick={() => setShowCleanup(true)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">
                {quotaStatus.level === 'blocked' ? '🚫' : '⚠️'}
              </span>
              <h3 className="font-semibold">
                Storage {quotaStatus.level === 'blocked' ? 'Full' : 'Warning'}
              </h3>
            </div>

            <p className="text-sm mb-2">{quotaStatus.message}</p>

            <div className="flex items-center gap-2 text-sm">
              <span>Usage:</span>
              <span className="font-medium" data-testid="storage-percentage">
                {Math.round(quotaStatus.usageRatio * 100)}%
              </span>
              <span className="text-xs text-gray-500">
                ({formatBytes(quotaStatus.usageBytes)} / {formatBytes(quotaStatus.quotaBytes)})
              </span>
            </div>
          </div>

          <button
            onClick={() => setShowCleanup(true)}
            className={`${colors.button} text-sm font-medium hover:underline`}
          >
            Manage Storage →
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${
              quotaStatus.level === 'blocked'
                ? 'bg-red-500'
                : quotaStatus.level === 'warning'
                ? 'bg-amber-500'
                : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min(100, quotaStatus.usageRatio * 100)}%` }}
          />
        </div>
      </div>

      {/* Cleanup Modal */}
      {showCleanup && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowCleanup(false)}
          data-testid="cleanup-modal"
        >
          <div
            className="bg-white rounded-lg p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold mb-4">Manage Storage</h2>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Storage Used</span>
                <span className="font-semibold">
                  {Math.round(quotaStatus.usageRatio * 100)}%
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500"
                  style={{ width: `${quotaStatus.usageRatio * 100}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {formatBytes(quotaStatus.usageBytes)} used of {formatBytes(quotaStatus.quotaBytes)}
              </div>
            </div>

            {/* Cleanup Actions */}
            <div className="space-y-3 mb-6">
              <h3 className="font-semibold text-sm text-gray-700">Cleanup Options</h3>

              {quotaStatus.suggestions.map((suggestion, i) => (
                <div key={i} className="text-sm text-gray-600 flex items-start gap-2">
                  <span>•</span>
                  <span>{suggestion}</span>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={handleDeleteOldArticles}
                disabled={isCleaningUp}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                data-testid="delete-old-articles-button"
              >
                {isCleaningUp ? 'Cleaning...' : 'Delete Articles Older Than 90 Days'}
              </button>

              <button
                onClick={handleClearCache}
                disabled={isCleaningUp}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                data-testid="clear-cache-button"
              >
                {isCleaningUp ? 'Clearing...' : 'Clear All Cached Data'}
              </button>

              <button
                onClick={() => setShowCleanup(false)}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Conflict Resolution Panel
 * 
 * Displays sync conflicts and provides resolution options.
 * Users can choose to keep local changes, accept remote changes, or merge.
 * 
 * @see specs/004-client-side-features/spec.md#offline-sync-conflicts
 * @see specs/004-client-side-features/tasks.md#t017
 */

'use client';

import React, { useEffect, useState } from 'react';
import { offlineSyncManager, type OfflineConflict, type ConflictResolution } from '@/lib/indexeddb/offline-sync';

export default function ConflictsPage(): JSX.Element {
  const [conflicts, setConflicts] = useState<OfflineConflict[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    loadConflicts();
  }, []);

  const loadConflicts = async () => {
    setIsLoading(true);
    try {
      const conflictList = await offlineSyncManager.getConflicts();
      setConflicts(conflictList);
    } catch (error) {
      console.error('Failed to load conflicts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolve = async (articleId: string, resolution: ConflictResolution) => {
    setResolvingId(articleId);
    try {
      await offlineSyncManager.resolveConflict(articleId, resolution);
      // Reload conflicts
      await loadConflicts();
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      alert('Failed to resolve conflict');
    } finally {
      setResolvingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl p-6">
        <div className="text-center py-12">
          <div className="text-2xl mb-2">⏳</div>
          <p>Loading conflicts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Sync Conflicts</h1>
        <p className="mt-2 text-gray-600">
          Resolve conflicts between offline changes and remote updates
        </p>
      </div>

      {/* No Conflicts */}
      {conflicts.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            No Conflicts
          </h2>
          <p className="text-gray-500">
            All changes are synced successfully
          </p>
        </div>
      ) : (
        /* Conflict List */
        <div className="space-y-4">
          {conflicts.map((conflict) => (
            <ConflictCard
              key={conflict.articleId}
              conflict={conflict}
              isResolving={resolvingId === conflict.articleId}
              onResolve={handleResolve}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Conflict Card Component
 */
interface ConflictCardProps {
  conflict:    OfflineConflict;
  isResolving: boolean;
  onResolve:   (articleId: string, resolution: ConflictResolution) => void;
}

function ConflictCard({ conflict, isResolving, onResolve }: ConflictCardProps): JSX.Element {
  return (
    <div
      className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4"
      data-testid="conflict-item"
    >
      {/* Article Title */}
      <div className="flex items-start gap-3 mb-3">
        <span className="text-2xl">⚠️</span>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {conflict.title}
          </h3>

          {/* Conflict Reason */}
          <p className="text-sm text-amber-800 mb-2" data-testid="conflict-reason">
            {conflict.conflictReason}
          </p>

          {/* Conflict Details */}
          <div className="grid grid-cols-2 gap-4 mt-3 p-3 bg-white rounded border border-amber-200">
            {/* Local Changes */}
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">
                Your Local Changes
              </div>
              <div className="text-sm text-gray-600">
                {conflict.localChange || 'No local changes'}
              </div>
            </div>

            {/* Remote State */}
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">
                Remote State
              </div>
              <div className="text-sm text-gray-600">
                {conflict.remoteState === 'deleted' ? (
                  <span className="text-red-600">Article deleted</span>
                ) : (
                  <span>Article updated</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resolution Actions */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={() => onResolve(conflict.articleId, 'keepLocal')}
          disabled={isResolving}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          data-testid="keep-local-button"
        >
          {isResolving ? 'Resolving...' : 'Keep My Changes'}
        </button>

        <button
          onClick={() => onResolve(conflict.articleId, 'acceptRemote')}
          disabled={isResolving}
          className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 text-sm font-medium"
          data-testid="accept-remote-button"
        >
          {isResolving ? 'Resolving...' : 'Accept Remote'}
        </button>

        {conflict.remoteState !== 'deleted' && (
          <button
            onClick={() => onResolve(conflict.articleId, 'merge')}
            disabled={isResolving}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
          >
            {isResolving ? 'Resolving...' : 'Merge Both'}
          </button>
        )}
      </div>

      {/* Resolution Help Text */}
      <div className="mt-3 text-xs text-gray-600">
        <strong>Keep My Changes:</strong> Preserve your offline edits<br />
        <strong>Accept Remote:</strong> Use the latest version from the server<br />
        {conflict.remoteState !== 'deleted' && (
          <><strong>Merge Both:</strong> Keep your edits and accept content updates</>
        )}
      </div>
    </div>
  );
}

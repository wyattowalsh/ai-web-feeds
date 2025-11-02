/**
 * Annotation Panel
 * 
 * Provides UI for creating and managing annotations (highlights and notes).
 * Implements W3C Web Annotation Data Model with immediate IndexedDB persistence.
 * 
 * @see specs/004-client-side-features/tasks.md#t046
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Annotation, generateId, now } from '@/lib/indexeddb/db';

interface AnnotationPanelProps {
  articleId: string;
}

export function AnnotationPanel({ articleId }: AnnotationPanelProps): JSX.Element {
  const [isCreating, setIsCreating] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [color, setColor] = useState('#ffeb3b');

  // Load annotations for this article
  const annotations = useLiveQuery(
    () => db.annotations.where('articleId').equals(articleId).toArray(),
    [articleId]
  );

  useEffect(() => {
    // Listen for text selection
    const handleSelection = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();

      if (text && text.length > 0) {
        setSelectedText(text);
        setIsCreating(true);
      }
    };

    document.addEventListener('mouseup', handleSelection);
    return () => document.removeEventListener('mouseup', handleSelection);
  }, []);

  const handleCreateHighlight = async () => {
    if (!selectedText) return;

    const annotation: Annotation = {
      id:        generateId(),
      articleId,
      type:      'highlight',
      selector:  {
        type:  'TextQuoteSelector',
        exact: selectedText,
      },
      content:   selectedText,
      createdAt: now(),
      updatedAt: now(),
      color,
      tags:      [],
    };

    // Immediate write to IndexedDB
    await db.annotations.add(annotation);

    // Reset
    setIsCreating(false);
    setSelectedText('');
  };

  const handleCreateNote = async () => {
    if (!noteContent.trim()) return;

    const annotation: Annotation = {
      id:        generateId(),
      articleId,
      type:      'note',
      selector:  {
        type:  'TextQuoteSelector',
        exact: selectedText || '',
      },
      content:   noteContent,
      createdAt: now(),
      updatedAt: now(),
      tags:      [],
    };

    await db.annotations.add(annotation);

    // Reset
    setIsCreating(false);
    setSelectedText('');
    setNoteContent('');
  };

  const handleDelete = async (id: string) => {
    await db.annotations.delete(id);
  };

  return (
    <div className="border-l border-gray-200 p-4 bg-gray-50 h-full overflow-y-auto">
      <h2 className="text-lg font-semibold mb-4">Annotations</h2>

      {/* Create Annotation */}
      {isCreating && selectedText && (
        <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
          <div className="mb-2 text-sm text-gray-600">Selected:</div>
          <div className="mb-3 p-2 bg-gray-50 rounded text-sm italic">
            "{selectedText.substring(0, 100)}{selectedText.length > 100 ? '...' : ''}"
          </div>

          {/* Color Picker for Highlights */}
          <div className="mb-3">
            <label className="text-sm text-gray-700 mb-1 block">Highlight Color</label>
            <div className="flex gap-2">
              {['#ffeb3b', '#4caf50', '#2196f3', '#f44336', '#9c27b0'].map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded border-2 ${
                    color === c ? 'border-gray-900' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Note Input */}
          <div className="mb-3">
            <label className="text-sm text-gray-700 mb-1 block">Add Note (Optional)</label>
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Write a note..."
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleCreateHighlight}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              Highlight
            </button>
            <button
              onClick={handleCreateNote}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
            >
              Add Note
            </button>
            <button
              onClick={() => {
                setIsCreating(false);
                setSelectedText('');
                setNoteContent('');
              }}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Annotation List */}
      <div className="space-y-3">
        {!annotations || annotations.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            <div className="text-3xl mb-2">📝</div>
            <p>No annotations yet</p>
            <p className="text-xs mt-1">Select text to highlight or add notes</p>
          </div>
        ) : (
          annotations.map((annotation) => (
            <div
              key={annotation.id}
              className="p-3 bg-white rounded border border-gray-200"
            >
              {/* Type Badge */}
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    annotation.type === 'highlight'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {annotation.type}
                </span>
                <button
                  onClick={() => handleDelete(annotation.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>

              {/* Content */}
              {annotation.type === 'highlight' && annotation.color && (
                <div
                  className="mb-2 p-2 rounded text-sm"
                  style={{ backgroundColor: annotation.color + '40' }}
                >
                  "{annotation.selector.exact}"
                </div>
              )}

              {annotation.type === 'note' && (
                <div className="text-sm text-gray-700">
                  {annotation.content}
                </div>
              )}

              {/* Timestamp */}
              <div className="mt-2 text-xs text-gray-500">
                {new Date(annotation.createdAt).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

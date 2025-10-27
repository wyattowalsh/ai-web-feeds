/**
 * Keyboard Shortcuts Manager
 * 
 * Handles all keyboard shortcuts throughout the app.
 * Supports single keys, modifier combinations, and sequences.
 */

import { useEffect, useCallback } from 'react';
import { preferences } from './db';

export type ShortcutAction =
  | 'next_article'
  | 'previous_article'
  | 'mark_as_read'
  | 'star'
  | 'archive'
  | 'open_original'
  | 'refresh'
  | 'search'
  | 'go_home'
  | 'go_starred'
  | 'go_unread'
  | 'go_all'
  | 'close_modal'
  | 'show_shortcuts'
  | 'toggle_sidebar'
  | 'focus_search';

export type ShortcutHandler = () => void;

interface ShortcutRegistration {
  action: ShortcutAction;
  handler: ShortcutHandler;
  description: string;
}

class KeyboardShortcutManager {
  private handlers = new Map<ShortcutAction, ShortcutHandler[]>();
  private shortcuts = new Map<string, ShortcutAction>();
  private sequenceBuffer: string[] = [];
  private sequenceTimeout: NodeJS.Timeout | null = null;
  private enabled = true;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown.bind(this));
      this.loadShortcuts();
    }
  }

  /**
   * Load shortcuts from preferences
   */
  private async loadShortcuts(): Promise<void> {
    try {
      const prefs = await preferences.get();
      this.shortcuts.clear();
      
      Object.entries(prefs.keyboardShortcuts).forEach(([key, action]) => {
        this.shortcuts.set(key, action as ShortcutAction);
      });
    } catch (error) {
      console.error('Failed to load keyboard shortcuts:', error);
      // Use defaults from schema
      this.loadDefaultShortcuts();
    }
  }

  /**
   * Load default shortcuts
   */
  private loadDefaultShortcuts(): void {
    const defaults = {
      'j': 'next_article',
      'k': 'previous_article',
      'm': 'mark_as_read',
      's': 'star',
      'a': 'archive',
      'v': 'open_original',
      'r': 'refresh',
      '/': 'search',
      'g h': 'go_home',
      'g s': 'go_starred',
      'g u': 'go_unread',
      'g a': 'go_all',
      'escape': 'close_modal',
      '?': 'show_shortcuts',
      '[': 'toggle_sidebar',
      'ctrl+k': 'focus_search',
    };

    Object.entries(defaults).forEach(([key, action]) => {
      this.shortcuts.set(key, action as ShortcutAction);
    });
  }

  /**
   * Handle keydown events
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.enabled) return;

    // Ignore shortcuts when typing in inputs
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      // Allow ctrl+k to focus search from input
      if (event.ctrlKey && event.key === 'k') {
        event.preventDefault();
        this.triggerAction('focus_search');
      }
      return;
    }

    const key = this.getKeyString(event);
    
    // Check for sequence shortcuts (e.g., "g h")
    if (this.sequenceBuffer.length > 0) {
      const sequence = [...this.sequenceBuffer, key].join(' ');
      
      if (this.shortcuts.has(sequence)) {
        event.preventDefault();
        this.triggerAction(this.shortcuts.get(sequence)!);
        this.clearSequence();
        return;
      }
      
      // Check if sequence could continue
      const potentialSequences = Array.from(this.shortcuts.keys()).filter(
        (s) => s.startsWith(this.sequenceBuffer.join(' ') + ' ')
      );
      
      if (potentialSequences.length === 0) {
        this.clearSequence();
      }
    }

    // Check for direct shortcuts
    if (this.shortcuts.has(key)) {
      event.preventDefault();
      this.triggerAction(this.shortcuts.get(key)!);
      return;
    }

    // Check if this could start a sequence
    const potentialSequences = Array.from(this.shortcuts.keys()).filter(
      (s) => s.startsWith(key + ' ')
    );
    
    if (potentialSequences.length > 0) {
      this.sequenceBuffer.push(key);
      this.startSequenceTimeout();
    }
  }

  /**
   * Get key string from event
   */
  private getKeyString(event: KeyboardEvent): string {
    const parts: string[] = [];

    if (event.ctrlKey) parts.push('ctrl');
    if (event.altKey) parts.push('alt');
    if (event.shiftKey && event.key.length > 1) parts.push('shift');
    if (event.metaKey) parts.push('meta');

    const key = event.key.toLowerCase();
    if (key !== 'control' && key !== 'alt' && key !== 'shift' && key !== 'meta') {
      parts.push(key);
    }

    return parts.join('+');
  }

  /**
   * Start sequence timeout
   */
  private startSequenceTimeout(): void {
    if (this.sequenceTimeout) {
      clearTimeout(this.sequenceTimeout);
    }
    
    this.sequenceTimeout = setTimeout(() => {
      this.clearSequence();
    }, 1000); // 1 second to complete sequence
  }

  /**
   * Clear sequence buffer
   */
  private clearSequence(): void {
    this.sequenceBuffer = [];
    if (this.sequenceTimeout) {
      clearTimeout(this.sequenceTimeout);
      this.sequenceTimeout = null;
    }
  }

  /**
   * Trigger action
   */
  private triggerAction(action: ShortcutAction): void {
    const handlers = this.handlers.get(action);
    if (handlers) {
      handlers.forEach((handler) => handler());
    }
  }

  /**
   * Register shortcut handler
   */
  register(action: ShortcutAction, handler: ShortcutHandler): () => void {
    if (!this.handlers.has(action)) {
      this.handlers.set(action, []);
    }

    this.handlers.get(action)!.push(handler);

    // Return unregister function
    return () => {
      const handlers = this.handlers.get(action);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * Enable/disable shortcuts
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Update shortcut mapping
   */
  async updateShortcut(action: ShortcutAction, key: string): Promise<void> {
    // Remove old mapping
    for (const [existingKey, existingAction] of this.shortcuts.entries()) {
      if (existingAction === action) {
        this.shortcuts.delete(existingKey);
      }
    }

    // Add new mapping
    this.shortcuts.set(key, action);

    // Save to preferences
    const prefs = await preferences.get();
    const newShortcuts = { ...prefs.keyboardShortcuts };
    
    // Remove old key for this action
    Object.keys(newShortcuts).forEach((k) => {
      if (newShortcuts[k] === action) {
        delete newShortcuts[k];
      }
    });
    
    // Add new key
    newShortcuts[key] = action;
    
    await preferences.update({ keyboardShortcuts: newShortcuts });
  }

  /**
   * Get all shortcuts
   */
  getShortcuts(): Map<string, ShortcutAction> {
    return new Map(this.shortcuts);
  }

  /**
   * Get key for action
   */
  getKeyForAction(action: ShortcutAction): string | undefined {
    for (const [key, act] of this.shortcuts.entries()) {
      if (act === action) {
        return key;
      }
    }
    return undefined;
  }
}

// Singleton instance
export const shortcutManager = new KeyboardShortcutManager();

/**
 * React hook for keyboard shortcuts
 */
export function useKeyboardShortcut(
  action: ShortcutAction,
  handler: ShortcutHandler,
  description?: string
): void {
  useEffect(() => {
    const unregister = shortcutManager.register(action, handler);
    return unregister;
  }, [action, handler]);
}

/**
 * React hook to get shortcut key for action
 */
export function useShortcutKey(action: ShortcutAction): string | undefined {
  const [key, setKey] = React.useState<string | undefined>();

  useEffect(() => {
    setKey(shortcutManager.getKeyForAction(action));
  }, [action]);

  return key;
}

/**
 * Shortcut descriptions for help modal
 */
export const SHORTCUT_DESCRIPTIONS: Record<ShortcutAction, string> = {
  next_article: 'Navigate to next article',
  previous_article: 'Navigate to previous article',
  mark_as_read: 'Mark article as read/unread',
  star: 'Star/unstar article',
  archive: 'Archive article',
  open_original: 'Open original article in new tab',
  refresh: 'Refresh feed',
  search: 'Focus search',
  go_home: 'Go to home',
  go_starred: 'Go to starred articles',
  go_unread: 'Go to unread articles',
  go_all: 'Go to all articles',
  close_modal: 'Close modal/dialog',
  show_shortcuts: 'Show keyboard shortcuts',
  toggle_sidebar: 'Toggle sidebar',
  focus_search: 'Focus search (global)',
};

/**
 * Format key for display
 */
export function formatKey(key: string): string {
  return key
    .split('+')
    .map((part) => {
      if (part === 'ctrl') return '⌃';
      if (part === 'alt') return '⌥';
      if (part === 'shift') return '⇧';
      if (part === 'meta') return '⌘';
      if (part === 'escape') return 'Esc';
      return part.toUpperCase();
    })
    .join('');
}

/**
 * Export for React
 */
import React from 'react';


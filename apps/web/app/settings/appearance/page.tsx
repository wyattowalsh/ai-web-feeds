/**
 * Appearance Settings Page
 * 
 * Allows users to customize themes, contrast, typography, and layout.
 * 
 * @see specs/004-client-side-features/tasks.md#t044
 */

'use client';

import React, { useState, useEffect } from 'react';

interface AppearanceSettings {
  theme:      'light' | 'dark' | 'auto';
  contrast:   'normal' | 'high';
  fontSize:   'small' | 'medium' | 'large' | 'x-large';
  fontFamily: 'system' | 'serif' | 'monospace';
  lineHeight: 'compact' | 'normal' | 'relaxed';
  maxWidth:   'narrow' | 'medium' | 'wide' | 'full';
}

const DEFAULT_SETTINGS: AppearanceSettings = {
  theme:      'auto',
  contrast:   'normal',
  fontSize:   'medium',
  fontFamily: 'system',
  lineHeight: 'normal',
  maxWidth:   'medium',
};

export default function AppearancePage(): JSX.Element {
  const [settings, setSettings] = useState<AppearanceSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    try {
      const stored = localStorage.getItem('aiwebfeeds.appearance');
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load appearance settings:', error);
    }
  };

  const saveSettings = (newSettings: AppearanceSettings) => {
    setSettings(newSettings);
    localStorage.setItem('aiwebfeeds.appearance', JSON.stringify(newSettings));
    applySettings(newSettings);
  };

  const applySettings = (settings: AppearanceSettings) => {
    const root = document.documentElement;

    // Theme
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else if (settings.theme === 'light') {
      root.classList.remove('dark');
    } else {
      // Auto: use system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    }

    // Font size
    const fontSizes = {
      small:   '14px',
      medium:  '16px',
      large:   '18px',
      'x-large': '20px',
    };
    root.style.fontSize = fontSizes[settings.fontSize];

    // Line height
    const lineHeights = {
      compact: '1.4',
      normal:  '1.6',
      relaxed: '1.8',
    };
    root.style.setProperty('--line-height', lineHeights[settings.lineHeight]);

    // Max width
    const maxWidths = {
      narrow: '640px',
      medium: '768px',
      wide:   '1024px',
      full:   '100%',
    };
    root.style.setProperty('--max-width', maxWidths[settings.maxWidth]);
  };

  const handleReset = () => {
    saveSettings(DEFAULT_SETTINGS);
  };

  return (
    <div className="container mx-auto max-w-2xl p-6">
      <h1 className="text-3xl font-bold mb-6">Appearance Settings</h1>

      {/* Theme */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Theme</h2>
        <div className="grid grid-cols-3 gap-2">
          {(['light', 'dark', 'auto'] as const).map((theme) => (
            <button
              key={theme}
              onClick={() => saveSettings({ ...settings, theme })}
              className={`p-4 rounded-lg border-2 ${
                settings.theme === theme
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-1">
                {theme === 'light' ? '☀️' : theme === 'dark' ? '🌙' : '⚙️'}
              </div>
              <div className="text-sm font-medium capitalize">{theme}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Font Size */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Font Size</h2>
        <div className="space-y-2">
          {(['small', 'medium', 'large', 'x-large'] as const).map((size) => (
            <label key={size} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="fontSize"
                checked={settings.fontSize === size}
                onChange={() => saveSettings({ ...settings, fontSize: size })}
                className="w-4 h-4"
              />
              <span className="capitalize">{size.replace('-', ' ')}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Contrast */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Contrast</h2>
        <div className="space-y-2">
          {(['normal', 'high'] as const).map((contrast) => (
            <label key={contrast} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="contrast"
                checked={settings.contrast === contrast}
                onChange={() => saveSettings({ ...settings, contrast })}
                className="w-4 h-4"
              />
              <span className="capitalize">{contrast}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Line Height */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Line Height</h2>
        <div className="space-y-2">
          {(['compact', 'normal', 'relaxed'] as const).map((lineHeight) => (
            <label key={lineHeight} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="lineHeight"
                checked={settings.lineHeight === lineHeight}
                onChange={() => saveSettings({ ...settings, lineHeight })}
                className="w-4 h-4"
              />
              <span className="capitalize">{lineHeight}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Max Width */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Reading Width</h2>
        <div className="space-y-2">
          {(['narrow', 'medium', 'wide', 'full'] as const).map((maxWidth) => (
            <label key={maxWidth} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="maxWidth"
                checked={settings.maxWidth === maxWidth}
                onChange={() => saveSettings({ ...settings, maxWidth })}
                className="w-4 h-4"
              />
              <span className="capitalize">{maxWidth}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Reset Button */}
      <div className="mt-8">
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}

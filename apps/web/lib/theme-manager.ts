/**
 * Theme Manager
 *
 * Manages app theming with support for:
 * - Light/Dark/System modes
 * - Custom color schemes
 * - Font preferences
 * - Reading width
 * - Persistent storage in IndexedDB
 */

import { preferences, type Preferences } from './db';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ReadingWidth = 'narrow' | 'medium' | 'wide';
export type LayoutMode = 'list' | 'cards' | 'compact';

export interface ThemeColors {
  // Background colors
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;

  // Text colors
  text: string;
  textSecondary: string;
  textTertiary: string;

  // UI colors
  border: string;
  divider: string;
  overlay: string;

  // Brand colors
  primary: string;
  primaryHover: string;
  secondary: string;
  secondaryHover: string;

  // Status colors
  success: string;
  warning: string;
  error: string;
  info: string;

  // Interactive colors
  linkText: string;
  linkHover: string;
  selection: string;
}

export interface ThemeConfig {
  mode: ThemeMode;
  fontSize: number;
  fontFamily: string;
  readingWidth: ReadingWidth;
  layout: LayoutMode;
  showImages: boolean;
  customColors?: Partial<ThemeColors>;
}

class ThemeManager {
  private currentTheme: ThemeMode = 'system';
  private listeners: Set<(theme: 'light' | 'dark') => void> = new Set();
  private mediaQuery: MediaQueryList | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  /**
   * Initialize theme manager
   */
  private async initialize(): Promise<void> {
    // Load saved preferences
    const prefs = await preferences.get();
    this.currentTheme = prefs.theme;

    // Set up system theme listener
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaQuery.addEventListener('change', this.handleSystemThemeChange.bind(this));

    // Apply initial theme
    this.applyTheme();
    this.applyFontSettings(prefs);
    this.applyLayoutSettings(prefs);
  }

  /**
   * Handle system theme change
   */
  private handleSystemThemeChange(): void {
    if (this.currentTheme === 'system') {
      this.applyTheme();
    }
  }

  /**
   * Get effective theme (resolves 'system' to 'light' or 'dark')
   */
  private getEffectiveTheme(): 'light' | 'dark' {
    if (this.currentTheme === 'system') {
      return this.mediaQuery?.matches ? 'dark' : 'light';
    }
    return this.currentTheme;
  }

  /**
   * Apply theme to document
   */
  private applyTheme(): void {
    const effectiveTheme = this.getEffectiveTheme();

    // Update document class
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(effectiveTheme);

    // Update meta theme-color
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute(
        'content',
        effectiveTheme === 'dark' ? '#1a1a1a' : '#ffffff'
      );
    }

    // Apply CSS variables
    this.applyCSSVariables(effectiveTheme);

    // Notify listeners
    this.listeners.forEach((listener) => listener(effectiveTheme));
  }

  /**
   * Apply CSS variables
   */
  private applyCSSVariables(theme: 'light' | 'dark'): void {
    const root = document.documentElement;
    const colors = theme === 'dark' ? this.getDarkColors() : this.getLightColors();

    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${this.kebabCase(key)}`, value);
    });
  }

  /**
   * Get light theme colors
   */
  private getLightColors(): ThemeColors {
    return {
      background: '#f7f4ee',
      backgroundSecondary: '#fffdfa',
      backgroundTertiary: '#ece7dc',
      text: '#222b3b',
      textSecondary: '#667086',
      textTertiary: '#9ca4b6',
      border: '#ddd6c7',
      divider: '#e7e0d4',
      overlay: 'rgba(0, 0, 0, 0.5)',
      primary: '#4a5fd4',
      primaryHover: '#394bb0',
      secondary: '#768096',
      secondaryHover: '#5e677c',
      success: '#2f9f72',
      warning: '#d6a437',
      error: '#d2615b',
      info: '#2e7ba8',
      linkText: '#4a5fd4',
      linkHover: '#394bb0',
      selection: 'rgba(74, 95, 212, 0.14)',
    };
  }

  /**
   * Get dark theme colors
   */
  private getDarkColors(): ThemeColors {
    return {
      background: '#1f2530',
      backgroundSecondary: '#2a313d',
      backgroundTertiary: '#353d4c',
      text: '#f2ede4',
      textSecondary: '#c1c7d3',
      textTertiary: '#8d98ab',
      border: '#474f5f',
      divider: '#343b4a',
      overlay: 'rgba(0, 0, 0, 0.7)',
      primary: '#8b9cf0',
      primaryHover: '#a5b1f5',
      secondary: '#7e889c',
      secondaryHover: '#a0abbd',
      success: '#4fbd8a',
      warning: '#e4bf62',
      error: '#ef8a84',
      info: '#5ea4d1',
      linkText: '#8b9cf0',
      linkHover: '#a5b1f5',
      selection: 'rgba(139, 156, 240, 0.22)',
    };
  }

  /**
   * Apply font settings
   */
  private applyFontSettings(prefs: Preferences): void {
    const root = document.documentElement;

    root.style.setProperty('--font-size-base', `${prefs.fontSize}px`);
    root.style.setProperty('--font-family', prefs.fontFamily);
  }

  /**
   * Apply layout settings
   */
  private applyLayoutSettings(prefs: Preferences): void {
    const root = document.documentElement;

    // Reading width
    const widthMap = {
      narrow: '600px',
      medium: '800px',
      wide: '1000px',
    };
    root.style.setProperty('--reading-width', widthMap[prefs.readingWidth]);

    // Layout mode
    root.setAttribute('data-layout', prefs.layout);
  }

  /**
   * Set theme mode
   */
  async setTheme(theme: ThemeMode): Promise<void> {
    this.currentTheme = theme;
    await preferences.update({ theme });
    this.applyTheme();
  }

  /**
   * Get current theme mode
   */
  getTheme(): ThemeMode {
    return this.currentTheme;
  }

  /**
   * Get effective theme
   */
  getEffectiveThemeMode(): 'light' | 'dark' {
    return this.getEffectiveTheme();
  }

  /**
   * Toggle theme
   */
  async toggleTheme(): Promise<void> {
    const effectiveTheme = this.getEffectiveTheme();
    const newTheme = effectiveTheme === 'light' ? 'dark' : 'light';
    await this.setTheme(newTheme);
  }

  /**
   * Set font size
   */
  async setFontSize(size: number): Promise<void> {
    await preferences.update({ fontSize: size });
    const prefs = await preferences.get();
    this.applyFontSettings(prefs);
  }

  /**
   * Set font family
   */
  async setFontFamily(family: string): Promise<void> {
    await preferences.update({ fontFamily: family });
    const prefs = await preferences.get();
    this.applyFontSettings(prefs);
  }

  /**
   * Set reading width
   */
  async setReadingWidth(width: ReadingWidth): Promise<void> {
    await preferences.update({ readingWidth: width });
    const prefs = await preferences.get();
    this.applyLayoutSettings(prefs);
  }

  /**
   * Set layout mode
   */
  async setLayout(layout: LayoutMode): Promise<void> {
    await preferences.update({ layout });
    const prefs = await preferences.get();
    this.applyLayoutSettings(prefs);
  }

  /**
   * Toggle images
   */
  async toggleImages(): Promise<void> {
    const prefs = await preferences.get();
    await preferences.update({ showImages: !prefs.showImages });
  }

  /**
   * Add theme change listener
   */
  addListener(listener: (theme: 'light' | 'dark') => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Convert camelCase to kebab-case
   */
  private kebabCase(str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }

  /**
   * Export current theme as CSS
   */
  exportThemeCSS(): string {
    const effectiveTheme = this.getEffectiveTheme();
    const colors = effectiveTheme === 'dark' ? this.getDarkColors() : this.getLightColors();

    const css = [':root {'];
    Object.entries(colors).forEach(([key, value]) => {
      css.push(`  --color-${this.kebabCase(key)}: ${value};`);
    });
    css.push('}');

    return css.join('\n');
  }
}

// Singleton instance
export const themeManager = new ThemeManager();

/**
 * React hooks for theme management
 */
import { useState, useEffect } from 'react';

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>('system');
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    setTheme(themeManager.getTheme());
    setEffectiveTheme(themeManager.getEffectiveThemeMode());

    const unsubscribe = themeManager.addListener((newTheme) => {
      setEffectiveTheme(newTheme);
    });

    return unsubscribe;
  }, []);

  const toggleTheme = async () => {
    await themeManager.toggleTheme();
    setTheme(themeManager.getTheme());
    setEffectiveTheme(themeManager.getEffectiveThemeMode());
  };

  const setThemeMode = async (mode: ThemeMode) => {
    await themeManager.setTheme(mode);
    setTheme(mode);
    setEffectiveTheme(themeManager.getEffectiveThemeMode());
  };

  return {
    theme,
    effectiveTheme,
    toggleTheme,
    setTheme: setThemeMode,
    isDark: effectiveTheme === 'dark',
  };
}

export function useFontSize() {
  const [fontSize, setFontSizeState] = useState(16);

  useEffect(() => {
    preferences.get().then((prefs) => setFontSizeState(prefs.fontSize));
  }, []);

  const setFontSize = async (size: number) => {
    await themeManager.setFontSize(size);
    setFontSizeState(size);
  };

  return { fontSize, setFontSize };
}

export function useReadingWidth() {
  const [width, setWidthState] = useState<ReadingWidth>('medium');

  useEffect(() => {
    preferences.get().then((prefs) => setWidthState(prefs.readingWidth));
  }, []);

  const setWidth = async (newWidth: ReadingWidth) => {
    await themeManager.setReadingWidth(newWidth);
    setWidthState(newWidth);
  };

  return { width, setWidth };
}

export function useLayout() {
  const [layout, setLayoutState] = useState<LayoutMode>('cards');

  useEffect(() => {
    preferences.get().then((prefs) => setLayoutState(prefs.layout));
  }, []);

  const setLayout = async (newLayout: LayoutMode) => {
    await themeManager.setLayout(newLayout);
    setLayoutState(newLayout);
  };

  return { layout, setLayout };
}

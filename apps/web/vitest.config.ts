import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/**
 * Vitest Configuration for Client-Side Features
 * 
 * Configures unit and integration testing environment with:
 * - JSDOM for browser API simulation
 * - React Testing Library support
 * - Coverage instrumentation (≥90% target)
 * - Path aliases matching tsconfig.json
 * 
 * @see specs/004-client-side-features/tasks.md#t003
 */

export default defineConfig({
  plugins: [react()],
  
  test: {
    // Use JSDOM for browser environment simulation
    environment: 'jsdom',
    
    // Global test setup
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    
    // Coverage configuration
    coverage: {
      provider:   'v8',
      reporter:   ['text', 'html', 'json', 'lcov'],
      exclude:    [
        'node_modules/**',
        'tests/**',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/types/**',
        '**/*.d.ts',
        'scripts/**',
        'public/**',
        '.next/**',
        'out/**',
      ],
      thresholds: {
        lines:      90,
        functions:  90,
        branches:   90,
        statements: 90,
      },
    },
    
    // Test file patterns
    include: [
      'tests/**/*.test.{ts,tsx}',
      'tests/**/*.spec.{ts,tsx}',
    ],
    
    // Exclude E2E tests (handled by Playwright)
    exclude: [
      'node_modules/**',
      'tests/e2e/**',
      '.next/**',
    ],
    
    // Timeouts
    testTimeout: 10000,
    hookTimeout: 10000,
    
    // Reporters
    reporters: process.env.CI ? ['dot', 'json'] : ['verbose'],
    
    // Watch mode configuration
    watch: true,
  },
  
  // Path resolution (match Next.js config)
  resolve: {
    alias: {
      '@':               resolve(__dirname, '.'),
      '@/app':           resolve(__dirname, './app'),
      '@/components':    resolve(__dirname, './components'),
      '@/lib':           resolve(__dirname, './lib'),
      '@/workers':       resolve(__dirname, './workers'),
      '@/service-worker': resolve(__dirname, './service-worker'),
      '@/tests':         resolve(__dirname, './tests'),
    },
  },
});

import type { Result, RunOptions } from 'axe-core';

/**
 * Minimal, type-safe axe helper module for E2E Playwright a11y smoke tests.
 * Provides the exact symbols imported by route-stabilization.spec.ts (and matches
 * usage with axe-playwright's getViolations which accepts RunOptions and returns Result[]).
 *
 * This is a pre-existing gap fix (no CSP, no security, no middleware changes).
 * Prefers existing dev deps (axe-core, axe-playwright already present).
 * Thin real implementation: uses axe-core types directly; reasonable defaults + summarizers.
 */

export const PLAYWRIGHT_AXE_OPTIONS: RunOptions = {
  // Sensible defaults for route-stabilization E2E smoke (wcag + best-practice tags).
  // Matches common axe-playwright + @axe-core usage in the monorepo's test:a11y intent.
  runOnly: {
    type: 'tag',
    values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'],
  },
  // Keep result types focused; allow full node details for summarizer.
  resultTypes: ['violations'],
};

export interface AxeViolationSummary {
  id: string;
  impact: Result['impact'];
  description: string;
  help: string;
  helpUrl: string;
  nodeCount: number;
}

export function summarizeAxeViolations(violations: Result[]): AxeViolationSummary[] {
  if (!violations || violations.length === 0) return [];
  return violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    description: violation.description,
    help: violation.help,
    helpUrl: violation.helpUrl,
    nodeCount: Array.isArray(violation.nodes) ? violation.nodes.length : 0,
  }));
}

export function buildAxeFailureMessage(title: string, summary: AxeViolationSummary[]): string {
  const count = summary.length;
  if (count === 0) {
    return title + ': 0 violations.';
  }
  const first = summary[0];
  const firstDetail = first ? ' (first: ' + first.id + ' impact=' + (first.impact != null ? first.impact : 'n/a') + ')' : '';
  return title + ': ' + count + ' accessibility violation(s) detected' + firstDetail + '. See attached axe-violations.json for full details and node selectors.';
}

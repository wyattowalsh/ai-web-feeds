#!/usr/bin/env bash
# Validates Spec 004 quickstart commands from specs/004-client-side-features/quickstart.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "→ pnpm exec vitest run --passWithNoTests"
pnpm exec vitest run --passWithNoTests >/dev/null

echo "→ pnpm exec tsc --noEmit"
pnpm exec tsc --noEmit

echo "→ pnpm run build:workers"
pnpm run build:workers

echo "→ playwright spec 004 smoke (chromium)"
pnpm exec playwright test \
  tests/e2e/search-filters.spec.ts \
  tests/e2e/organization-folders.spec.ts \
  tests/e2e/extension-queue.spec.ts \
  tests/e2e/extension-firefox.spec.ts \
  tests/e2e/export-import.spec.ts \
  tests/e2e/offline-reading.spec.ts \
  --project=chromium

echo "✓ Quickstart validation passed"

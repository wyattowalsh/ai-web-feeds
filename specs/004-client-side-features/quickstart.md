# Quickstart — Client-Side Power Features

## Prerequisites
- Node.js 20+ with pnpm 9.x.
- Chrome/Edge/Firefox for testing Service Worker, PWA, and extension flows.
- Enable experimental `chrome://flags/#enable-desktop-pwas-sub-apps` if testing advanced PWA background sync locally.

## 1. Install & Bootstrap
```bash
cd apps/web
pnpm install
pnpm dev --turbo
```
- Dev server runs at `http://localhost:3000`.
- Service Worker requires HTTPS; Next.js provides secure localhost via `next dev --experimental-https`. For local testing run:
  ```bash
  pnpm dev -- --experimental-https
  ```

## 2. Seed Sample Data
1. Visit `/explorer` and import `data/feeds.yaml` via the importer (client-side).
2. Use the onboarding wizard to subscribe to suggested feeds and trigger initial sync.
3. Click “Save for Offline” on a feed to populate IndexedDB stores.

## 3. Run Tests
```bash
# Unit / integration
pnpm exec vitest run --coverage

# E2E offline scenarios (launches Playwright)
pnpm exec playwright test --project=chromium
```
- Use `PLAYWRIGHT_BYPASS_CSP=1` when debugging Service Worker updates.
- Tests include storage quota simulations, offline conflict resolution, and search performance budgets.

## 4. Develop Workers & Service Worker
- Worker source lives in `apps/web/workers/`.
- Rebuild workers on change with:
  ```bash
  pnpm exec tsx scripts/build-workers.ts --watch
  ```
- Service Worker bundle generated from `apps/web/service-worker/sw.ts`. During dev, use `navigator.serviceWorker.getRegistration()?.update()` in console to reload changes.

## 5. Browser Extension Workflow
```bash
cd apps/web/extension
pnpm install
pnpm run build:chrome   # outputs to dist/chrome
pnpm run build:firefox  # outputs to dist/firefox
```
- Load unpacked extension in Chrome/Firefox, then trigger “Save to AI Web Feeds” on any article to confirm `extension_queue` ingestion.

## 6. Export & Import Validation
1. Navigate to Settings → Data Portability.
2. Trigger exports for JSON, CSV, OPML, HTML; verify downloads complete <5 s for seeded data.
3. Import exported JSON on a fresh profile to confirm parity.

## 7. Diagnostics & Logs
- Open DevTools → Application to inspect IndexedDB tables (`Dexie` provides live tables).
- Use Settings → “Export Debug Logs” to download the local log buffer before filing issues.
- Storage dashboard surfaces usage thresholds (70 % info, 80 % warning, 90 % block).

## 8. Commit & Documentation
- Document feature behavior in `apps/web/content/docs/features/*.mdx` and update `meta.json`.
- Ensure `pnpm lint` and `pnpm exec vitest run --coverage` succeed prior to opening PRs.

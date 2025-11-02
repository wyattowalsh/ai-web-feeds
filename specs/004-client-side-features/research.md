# Research Log — Phase 4 Client-Side Features

All previously identified clarifications and dependency reviews have been resolved below. Each entry follows the required Decision/Rationale/Alternatives structure.

## IndexedDB Abstraction
- **Decision**: Adopt Dexie.js 4 for IndexedDB schema management across articles, search index, annotations, and reading history.
- **Rationale**: Dexie provides transactional helpers, versioned migrations, and strong TypeScript support—critical for evolving schemas (Phase 4A–4D) while keeping code maintainable. Its bulk operations and live queries simplify quota monitoring and conflict resolution logic.
- **Alternatives considered**:  
  - `idb` (Jake Archibald) — lightweight but would require building our own migration and bulk APIs; increases implementation time.  
  - Raw IndexedDB — highest control but significantly more boilerplate, higher bug risk.  
  - Lovefield/LocalForage — either discontinued or not suited for the complex indexing needed for <50 ms search.

## Testing Strategy for Offline & PWA Flows
- **Decision**: Combine Playwright for end-to-end offline/PWA scenarios with Vitest + Testing Library for unit/integration coverage.
- **Rationale**: Playwright’s network emulation and Service Worker control enable reliable offline-mode tests, storage quota simulations, and extension messaging checks. Vitest integrates smoothly with Next.js 15 for component/unit tests, runs in-node with JSDOM, and supports coverage instrumentation to maintain ≥90 %.
- **Alternatives considered**:  
  - Cypress — weaker Service Worker support and slower parallelization in CI.  
  - Jest — mature but Vitest offers faster TypeScript support and easier worker testing.  
  - Relying solely on Playwright — insufficient granularity for workers and utility functions.

## Client-Side AI Runtime
- **Decision**: Use `onnxruntime-web` with quantized transformer models for summarization/sentiment tasks, executed via WebGPU when available and falling back to WASM.
- **Rationale**: ONNX Runtime Web supports transformer architectures with good performance on browsers (especially via WebGPU) and allows us to host pre-converted, quantized models alongside the app without backend calls. The runtime is framework-agnostic, making future model swaps easier.
- **Alternatives considered**:  
  - TensorFlow.js — solid but requires model conversion to TF format and exhibits larger bundle sizes for transformer NLP models.  
  - Transformers.js (Bundled ONNX) — higher-level but less control over caching and quantization strategies.  
  - WebLLM — powerful but overkill for lightweight summarization; adds heavy dependencies.

## Browser Extension Packaging
- **Decision**: Build a Manifest V3 extension bundled from `apps/web/extension/` using Vite, targeting Chromium first with Firefox compatibility via `browser-polyfill`.
- **Rationale**: Manifest V3 is required for Chrome store submissions and supports service-worker-based background scripts aligning with our client-only architecture. Vite simplifies multi-platform builds and enables sharing TypeScript models/utilities with the web app through workspace packages.
- **Alternatives considered**:  
  - Manifest V2 — deprecated for Chrome and disallowed for new submissions.  
  - Webpack-based build — heavier configuration and slower builds compared to Vite.  
  - Separate repo — would fracture shared code and violate documentation-first workflow.

## Storage Quota Monitoring Best Practices
- **Decision**: Implement periodic `navigator.storage.estimate()` checks with thresholds (70 % info, 80 % warning, 90 % hard block) and surface cleanup actions through settings UI.
- **Rationale**: Using the StorageManager API provides accurate quota metrics without blocking operations; aligning to 70/80/90 thresholds gives users proactive warnings and ensures we meet the spec’s “warn at 80 %” requirement with additional guardrails.
- **Alternatives considered**:  
  - Manual tracking via IndexedDB record counts — inaccurate due to browser compression and eviction policies.  
  - Relying on quota errors alone — reactive and violates UX requirements for early warnings.

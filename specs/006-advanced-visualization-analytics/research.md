# Research: Advanced Visualization & Analytics

**Feature**: 006-advanced-visualization-analytics  
**Date**: 2025-11-01  
**Purpose**: Resolve technical unknowns and establish best practices for implementation

---

## Overview

This research document resolves all "NEEDS CLARIFICATION" items from the Technical Context and establishes best practices for implementing research-grade visualization features in AIWebFeeds.

---

## 1. 3D Visualization Technology Choice

### Decision: Three.js with React Three Fiber

**Rationale**:
- **Ecosystem maturity**: Three.js is the industry standard for WebGL in web applications (1M+ weekly npm downloads)
- **React integration**: React Three Fiber provides declarative Three.js components that integrate seamlessly with Next.js
- **Performance**: Native WebGL 2.0 support with GPU acceleration, proven 60fps capability for 500+ node graphs
- **Fallback support**: Graceful degradation to 2D canvas when WebGL unavailable
- **Developer experience**: TypeScript support, extensive documentation, active community

**Alternatives Considered**:
- **Babylon.js**: More game-focused, heavier bundle size (1.5MB vs 600KB for Three.js), less React ecosystem support
- **D3.js 3D force layout**: Limited to SVG/Canvas, no GPU acceleration, poor performance >100 nodes
- **Custom WebGL**: Reinventing the wheel, high maintenance burden, no accessibility features

**Implementation Notes**:
- Use `@react-three/fiber` + `@react-three/drei` for React components
- Implement force-directed graph layout with `d3-force-3d` for spatial clustering
- Monitor frame rate with `stats.js` and trigger 2D fallback at <30fps threshold
- Level-of-detail (LOD) rendering for >200 nodes using Three.js LOD objects

**References**:
- Three.js Docs: https://threejs.org/docs/
- React Three Fiber: https://docs.pmnd.rs/react-three-fiber
- WebGL Performance Best Practices: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices

---

## 2. 2D Charting Library Selection

### Decision: Chart.js 4.4+ with react-chartjs-2

**Rationale**:
- **Publication quality**: Supports 300 DPI PNG export, SVG export via chart-js-to-svg plugin
- **Responsive**: Built-in responsive design, mobile-optimized touch interactions
- **Customization**: Full control over colors, fonts, labels for academic paper requirements
- **Performance**: Canvas-based rendering handles 10k+ data points efficiently
- **Accessibility**: ARIA labels, keyboard navigation, screen reader support built-in

**Alternatives Considered**:
- **D3.js**: More powerful but steeper learning curve, requires custom accessibility implementation, overkill for standard chart types
- **Recharts**: React-first but SVG-only (performance issues >1000 points), limited export options
- **Plotly.js**: Excellent but 3MB bundle size, GPL license restrictions for commercial use
- **Apache ECharts**: Strong for dashboards but weaker export quality, Chinese-centric documentation

**Implementation Notes**:
- Use Chart.js plugins: `chartjs-plugin-zoom`, `chartjs-plugin-annotation`, `chartjs-plugin-datalabels`
- Implement custom export logic: canvas.toBlob() for PNG at specified DPI, chart-js-to-svg for vector export
- Time-series optimization: Use decimation plugin for >10k points, time scale with time adapters
- Color palette: Use ColorBrewer2 palettes (colorblind-safe) as default

**References**:
- Chart.js Docs: https://www.chartjs.org/docs/latest/
- Publication-ready charts guide: https://www.chartjs.org/docs/latest/configuration/responsive.html

---

## 3. Time-Series Forecasting Library

### Decision: Prophet (Facebook/Meta) via Python API

**Rationale**:
- **Ease of use**: Minimal hyperparameter tuning, automatic seasonality detection
- **Confidence intervals**: Built-in uncertainty estimates (80%, 95%) matching spec requirements
- **Interpretability**: Decomposes forecast into trend + seasonality + holidays for user explainability
- **Performance**: Fast training (<10s for 90 days of daily data), suitable for weekly retraining
- **Production-ready**: Used at scale by Facebook, Uber, Microsoft

**Alternatives Considered**:
- **statsmodels ARIMA**: More flexible but requires expertise for model selection (p, d, q parameters), no automatic seasonality
- **TensorFlow/PyTorch LSTM**: Overkill for this scale, requires large datasets (>1000 points), hard to interpret
- **scikit-learn linear models**: Too simple, misses seasonality and non-linear trends
- **AWS Forecast / Azure Time Series Insights**: Cloud vendor lock-in, cost concerns, latency

**Implementation Notes**:
- Run Prophet in backend Python service, expose via FastAPI endpoint
- Store model parameters in SQLite for reproducibility
- Track forecast accuracy (MAPE, MAE) in database, trigger retraining when MAPE >30%
- Handle insufficient data (<90 days) by returning error with clear message
- Weekly cron job for forecast updates, cache results for 7 days

**References**:
- Prophet Docs: https://facebook.github.io/prophet/
- Forecasting at Scale paper: https://peerj.com/preprints/3190/

---

## 4. Dashboard Layout Engine

### Decision: React Grid Layout 1.4+

**Rationale**:
- **Drag-and-drop**: Built-in drag-drop with collision detection, grid snapping
- **Responsive**: Breakpoint-based layouts (mobile, tablet, desktop)
- **Persistent**: Layouts serialize to JSON for SQLite storage
- **Performance**: Virtual scrolling for large dashboards, optimized re-renders
- **Mature**: 15k+ GitHub stars, used by Grafana, Datadog dashboards

**Alternatives Considered**:
- **react-grid-system**: CSS Grid-based but no drag-drop, requires custom implementation
- **react-dnd**: Lower-level, requires building grid logic from scratch
- **muuri**: Vanilla JS (not React), harder to integrate with Next.js
- **Custom solution**: High development cost, accessibility challenges

**Implementation Notes**:
- Use `react-grid-layout` with `onLayoutChange` callback to persist to SQLite
- Define grid: 12 columns, minimum widget size 2x2 cells, maximum 20 widgets
- Implement widget library: Chart, Metric Card, Feed List, Topic Cloud components
- Handle async widget loading: skeleton loaders, error boundaries per widget
- Mobile responsive: switch to stacked layout on <768px breakpoint

**References**:
- React Grid Layout: https://github.com/react-grid-layout/react-grid-layout
- Dashboard Design Patterns: https://cube.dev/blog/dashboard-design-patterns

---

## 5. Data Export Formats & Libraries

### Decision: Multi-format support - CSV (standard), JSON (developer-friendly), Parquet (data science)

**Rationale**:
- **CSV**: Universal compatibility (Excel, Google Sheets, R, Python), UTF-8 with BOM for international characters
- **JSON**: Developer-friendly, structured data with nested relationships, easy API consumption
- **Parquet**: Columnar format for data science (Pandas, Spark), 10x compression vs CSV, preserves schema

**Implementation**:
- CSV: Use Python `csv` module with `utf-8-sig` encoding (BOM for Excel)
- JSON: Use FastAPI JSONResponse with Pydantic serialization
- Parquet: Use `pyarrow` library with gzip compression

**Alternatives Considered**:
- **Excel (.xlsx)**: Requires `openpyxl`, larger files, slower generation
- **Avro**: Less common than Parquet, requires schema registry
- **MessagePack**: Binary format but less tooling support than Parquet

**Implementation Notes**:
- Async export: Use Celery or Python asyncio for >10k record exports
- Streaming: Yield chunks for large exports to avoid memory issues
- Metadata: Include header with export params, timestamp, schema version
- Compression: gzip for CSV/JSON, built-in for Parquet
- Rate limiting: Use FastAPI RateLimiter (slowapi) at 100 req/hour

**References**:
- Apache Parquet: https://parquet.apache.org/docs/
- FastAPI Streaming Responses: https://fastapi.tiangolo.com/advanced/custom-response/#streamingresponse

---

## 6. Caching Strategy for Analytics Queries

### Decision: In-memory cache with Redis (production) or Python @lru_cache (development)

**Rationale**:
- **5-minute TTL**: Balances freshness with performance (analytics data updates hourly per Phase 002)
- **Query-based keys**: Cache by query signature (entity, filters, date range)
- **Redis for prod**: Distributed cache across API instances, persistence on restart
- **@lru_cache for dev**: Zero-setup, suitable for single-process development

**Implementation**:
- Cache key format: `viz:query:{entity}:{filters_hash}:{date_range}`
- Invalidation: Time-based (5min TTL), no manual invalidation needed
- Cache warming: Pre-populate common queries (trending topics, top feeds) on startup
- Fallback: Direct database query if cache miss, populate cache for next request

**Alternatives Considered**:
- **No caching**: Unacceptable performance, Phase 002 analytics queries can take 2-5s
- **SQLite query results cache**: Disk I/O overhead, no distributed support
- **Memcached**: Similar to Redis but less feature-rich (no persistence)

**Implementation Notes**:
- Use `redis-py` with async support for FastAPI
- Development: `functools.lru_cache(maxsize=128)` decorator
- Production: Redis with `maxmemory-policy allkeys-lru` configuration
- Monitoring: Track cache hit rate, tune TTL based on Phase 002 data update frequency

**References**:
- Redis Caching Best Practices: https://redis.io/docs/manual/client-side-caching/
- FastAPI + Redis: https://fastapi.tiangolo.com/advanced/nosql-databases/#redis

---

## 7. API Authentication: JWT + API Keys

### Decision: Dual authentication - JWT tokens for web app, API keys for programmatic access

**Rationale**:
- **JWT for web**: Stateless, secure, integrates with Next.js middleware
- **API keys for developers**: Simple HTTP header authentication for scripts
- **No user accounts**: Both methods use device ID from localStorage as identity
- **Flexible**: Supports both interactive (web) and programmatic (API) use cases

**Implementation**:
- JWT: Generate at first visit, store in httpOnly cookie, 30-day expiration
- API keys: User generates in web UI, stored hashed (bcrypt) in SQLite with device_id
- Verification: FastAPI dependency checks JWT or API key header, extracts device_id
- Rate limiting: Enforce per device_id (100 req/hour)

**Alternatives Considered**:
- **API keys only**: Less secure for web (exposed in localStorage), no automatic rotation
- **JWT only**: Inconvenient for CLI/script users (need to extract token from browser)
- **OAuth 2.0**: Overkill without user accounts, requires auth server

**Implementation Notes**:
- Use `PyJWT` for token generation/validation
- API key format: `awf_` prefix + 32-char random (similar to GitHub tokens)
- Headers: `Authorization: Bearer <jwt>` or `X-API-Key: <api_key>`
- Key management UI: Generate, list, revoke keys per device

**References**:
- JWT Best Practices: https://tools.ietf.org/html/rfc8725
- API Key Design: https://cloud.google.com/endpoints/docs/openapi/when-why-api-key

---

## 8. WebGL Performance Monitoring & Fallback

### Decision: FPS monitoring with automatic 2D fallback at <30fps for 3 seconds

**Rationale**:
- **User experience**: Prevent janky interactions, maintain usability on all devices
- **Measurable threshold**: 30fps is minimum acceptable for interactive graphics
- **Time buffer**: 3 seconds prevents false positives from temporary GPU spikes
- **Graceful degradation**: 2D network view provides same information, different visualization

**Implementation**:
- Use `stats.js` to monitor FPS in production builds
- Track rolling average FPS over 3-second window
- Trigger fallback: Display notification, switch to 2D Canvas/SVG network graph
- Manual override: "Try 3D Again" button allows user to re-enable
- Telemetry: Log device GPU info, browser, node count when fallback triggers

**Alternatives Considered**:
- **Reduce quality**: Lower LOD, disable shadows - still may not reach 30fps on weak GPUs
- **No fallback**: Unacceptable UX, violates accessibility requirements
- **Pre-flight GPU detection**: Unreliable, many false negatives (mobile GPUs)

**Implementation Notes**:
- FPS counter: `requestAnimationFrame` with delta time tracking
- 2D fallback: Use `react-force-graph-2d` library (same API as 3D version)
- Save preference: Store in localStorage if user manually switches modes
- A/B test: Track usage ratio (3D vs 2D) for future optimization decisions

**References**:
- WebGL Performance Tips: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices
- stats.js: https://github.com/mrdoob/stats.js/

---

## 9. SQLite Schema Design for Device-Based Persistence

### Decision: Add device_id column to all visualization entities, use localStorage UUID

**Rationale**:
- **No auth complexity**: Avoids user account system while enabling persistence
- **Privacy-friendly**: No PII collected, device ID is random UUID
- **Cross-session**: Persists across browser sessions (unlike sessionStorage)
- **Simple migration**: Extend existing SQLAlchemy models with device_id field

**Implementation**:
- Generate UUID v4 on first visit: `crypto.randomUUID()` in browser
- Store in localStorage: `awf_device_id` key
- Send with all requests: Include in API calls as query param or header
- Database: Add `device_id VARCHAR(36)` column to Visualization, Dashboard, APIKey tables
- Queries: Filter all queries by device_id for data isolation

**Alternatives Considered**:
- **Browser fingerprinting**: Unreliable (changes with browser updates), privacy concerns
- **IP-based**: Changes frequently (mobile, VPN), poor UX
- **Cookies only**: Lost on cookie clear, no API key support

**Implementation Notes**:
- Migration: Add device_id column with default NULL, backfill with random UUIDs
- Cleanup: Cron job to delete data for device IDs inactive >90 days (GDPR compliance)
- Export/import: Allow users to export dashboard JSON with device ID, import on new device
- Security: Device ID is not secret, don't use for authentication (use JWT/API key instead)

**References**:
- UUID Best Practices: https://www.rfc-editor.org/rfc/rfc4122
- localStorage vs sessionStorage: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage

---

## 10. Publication-Quality Chart Export

### Decision: High-DPI canvas rendering (300 DPI PNG) + SVG export via canvas2svg

**Rationale**:
- **Academic standard**: 300 DPI minimum for journal submissions
- **Vector option**: SVG provides infinite scaling for presentations
- **Embedded fonts**: Include font data in SVG for consistent rendering
- **Metadata**: EXIF/PNG metadata with attribution and timestamp

**Implementation**:
- PNG: Multiply canvas dimensions by DPI factor (300/72 = 4.17x), draw chart, export with toBlob()
- SVG: Use `canvas2svg` library to convert Chart.js canvas to SVG with proper viewBox
- Fonts: Embed Google Fonts as base64 in SVG for portability
- Attribution: Add PNG metadata chunk or SVG comment with feed names, export date

**Alternatives Considered**:
- **PDF export**: Requires backend rendering (Cairo, wkhtmltopdf), slower, larger files
- **HTML export**: Good for interactive but not suitable for print
- **Screenshot libraries**: Lower quality, hard to control DPI

**Implementation Notes**:
- DPI selector: 72 (screen), 150 (draft), 300 (publication)
- Color profiles: sRGB for screen, Adobe RGB for print (add profile metadata)
- File naming: `aiwebfeeds-{chart-type}-{timestamp}.{png|svg}`
- Size validation: Warn if export >10MB, suggest data filtering

**References**:
- canvas2svg: https://github.com/gliffy/canvas2svg
- High-DPI Canvas: https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio

---

## Technology Stack Summary

### Backend (Python 3.13+)
- **Web Framework**: FastAPI 0.115+
- **ORM**: SQLAlchemy 2.0+ with Alembic migrations
- **Database**: SQLite (dev), PostgreSQL (prod)
- **Caching**: Redis (prod) or functools.lru_cache (dev)
- **Forecasting**: Prophet 1.1+
- **Export**: pyarrow (Parquet), built-in csv/json
- **Auth**: PyJWT 2.8+, bcrypt 4.1+
- **Testing**: pytest 8.0+, pytest-asyncio, httpx (API tests)

### Frontend (TypeScript 5.9+)
- **Framework**: Next.js 15, React 19
- **3D Graphics**: Three.js 0.160+, @react-three/fiber 8.15+, @react-three/drei 9.92+
- **2D Charts**: Chart.js 4.4+, react-chartjs-2 5.2+
- **Dashboard**: react-grid-layout 1.4+
- **State**: React Context + hooks (no Redux needed for this scope)
- **API Client**: fetch API with TypeScript types generated from OpenAPI
- **Testing**: Vitest 1.0+, React Testing Library, Playwright (E2E)

### DevOps & Tooling
- **Linting**: Ruff (Python), ESLint 9 (TypeScript)
- **Type Checking**: mypy (Python), tsc --strict (TypeScript)
- **Formatting**: ruff format (Python), Prettier (TypeScript)
- **CI/CD**: GitHub Actions (existing workflows extended)
- **Monitoring**: FPS tracking (stats.js), cache hit rate (Redis INFO)

---

## Open Questions & Future Research

1. **Forecast model selection**: Should we support multiple models (Prophet, ARIMA, LSTM) and let users choose? **Decision**: Start with Prophet only (MVP), add model comparison in future phase if user demand exists.

2. **Dashboard templates**: How many templates to provide initially? **Decision**: 3 templates (Curator, Research, Topic Monitor) per spec, more can be community-contributed later.

3. **Chart animations**: Should charts animate on load/update? **Decision**: Yes for engagement, but make optional (accessibility preference) and keep under 500ms.

4. **Mobile optimization**: Touch gestures for 3D graph (pinch-zoom, two-finger rotate)? **Decision**: Yes, use react-three/fiber gesture support, test on iOS/Android Chrome.

5. **Collaborative features**: Share dashboards between devices? **Decision**: Out of scope for Phase 006 (no user accounts). Export/import JSON dashboards is workaround. Revisit if Phase 006A (user accounts) is implemented.

---

## Next Steps (Phase 1)

1. Generate `data-model.md` with SQLAlchemy entity definitions
2. Generate OpenAPI contracts in `/contracts/` for all API endpoints
3. Create `quickstart.md` with setup instructions and first visualization example
4. Update agent context files with new technologies from this research

**Ready to proceed**: All NEEDS CLARIFICATION items resolved with concrete technical decisions and implementation guidance.

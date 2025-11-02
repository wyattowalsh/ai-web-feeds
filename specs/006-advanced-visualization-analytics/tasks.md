# Tasks: Advanced Visualization & Analytics

**Input**: Design documents from `/specs/006-advanced-visualization-analytics/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Tests**: Not explicitly requested in feature specification - focusing on implementation tasks with manual testing per acceptance scenarios.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5, US6)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Install backend dependencies: FastAPI 0.115+, SQLAlchemy 2.0+, Pandas 2.2+, Prophet, redis-py
- [ ] T002 Install frontend dependencies: Three.js 0.160+, @react-three/fiber, @react-three/drei, Chart.js 4.4+, react-chartjs-2, react-grid-layout
- [ ] T003 [P] Run Alembic migration to create 7 new tables (Visualization, Dashboard, DashboardWidget, Forecast, APIKey, ExportJob, APIUsage) per data-model.md
- [ ] T004 [P] Create backend module structure: packages/ai_web_feeds/src/ai_web_feeds/visualization/ with __init__.py
- [ ] T005 [P] Create frontend page structure: apps/web/app/analytics/visualizations/ with layout.tsx
- [ ] T006 [P] Configure Redis cache (development: @lru_cache fallback if Redis unavailable) in packages/ai_web_feeds/src/ai_web_feeds/config.py
- [ ] T007 [P] Create device_id (UUID from localStorage) utility in apps/web/lib/device-id.ts (generates/retrieves localStorage UUID)
- [ ] T008 [P] Setup test structure: tests/packages/ai_web_feeds/visualization/ for backend, apps/web/__tests__/visualizations/ for frontend

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T009 Create SQLAlchemy models from data-model.md in packages/ai_web_feeds/src/ai_web_feeds/models.py: Visualization, Dashboard, DashboardWidget, Forecast, APIKey, ExportJob, APIUsage
- [ ] T010 Implement database query service with caching in packages/ai_web_feeds/src/ai_web_feeds/visualization/data_service.py (queries Phase 002 topic_metrics, feed_health, validation_logs tables)
- [ ] T010a Implement cache layer in packages/ai_web_feeds/src/ai_web_feeds/visualization/cache.py: Redis client with 5-minute TTL, fallback to in-memory LRU cache (100 entries), cache key generation using SHA-256(query_type + filters + date_range + device_id), cache versioning (v1:query:hash), implement cache invalidation on data writes
- [ ] T010b Add input validation layer in packages/ai_web_feeds/src/ai_web_feeds/visualization/validators.py: whitelist table names (topic_metrics, feed_health, validation_logs, article_metadata), validate date ranges, limit result size to 100k rows, sanitize LIKE clause inputs, reject SQL injection patterns
- [ ] T010c Implement error recovery in data_service.py: retry failed queries 3x with exponential backoff (1s, 3s, 9s), specific error messages ("Network timeout", "Database unavailable", "Invalid date range"), graceful fallback to cached data if fresh query fails
- [ ] T011 [P] Create FastAPI router in packages/ai_web_feeds/src/ai_web_feeds/visualization/api.py with CORS, error handling, and JWT + API key authentication middleware
- [ ] T011a Add security middleware in packages/ai_web_feeds/src/ai_web_feeds/visualization/security.py: input sanitization (escape HTML entities, validate numeric ranges, reject invalid dates), SQL injection prevention (parameterized queries only), XSS protection (CSP headers: script-src 'self'), CORS config (allow configured origins only)
- [ ] T011b Implement rate limiting in packages/ai_web_feeds/src/ai_web_feeds/visualization/rate_limit.py: track by device_id + IP address, exponential backoff (1min → 5min → 15min → 1hour) for violations, whitelist support for trusted API consumers, return 429 with Retry-After header
- [ ] T012 [P] Implement device_id (UUID from localStorage) authentication: JWT token generation (web) + API key CRUD endpoints in packages/ai_web_feeds/src/ai_web_feeds/visualization/auth.py
- [ ] T012a Add device_id utilities in apps/web/lib/device-id.ts: UUID v4 generation on first visit, localStorage persistence (key: "aiwebfeeds_device_id", format: v1:uuid:timestamp), validation (check UUID format, verify uniqueness), handle corruption (regenerate if invalid), collision handling (append random suffix if duplicate detected), quota monitoring (warn at 80% localStorage usage)
- [ ] T012b Implement device switching handler in apps/web/components/DeviceSwitchNotice.tsx: detect device changes (compare stored vs current device_id), display notice ("Visualizations are device-specific"), provide export/import feature (JSON bundle of all configs), document no-sync architecture decision
- [ ] T013 [P] Create base React components: apps/web/components/visualizations/ChartContainer.tsx (wrapper with error boundaries), LoadingSkeleton.tsx, ErrorDisplay.tsx
- [ ] T013a Add zero-state components in apps/web/components/visualizations/EmptyState.tsx: display helpful messages for empty queries ("No data available - adjust date range?"), suggested actions ("Add feeds", "Wait for analytics"), sample/demo visualizations for new users, contextual help per visualization type
- [ ] T013b Implement error recovery UI in apps/web/components/visualizations/ErrorRecovery.tsx: specific error messages with recovery actions, retry buttons with loading states, preserve user work during errors (save chart config to localStorage), show error history panel ("3 errors in last 5 minutes - View details")
- [ ] T014 [P] Setup Chart.js theme configuration in apps/web/lib/chart-themes.ts (colors, fonts, 300 DPI export settings)
- [ ] T015 [P] Implement FPS monitoring utility in apps/web/lib/performance-monitor.ts (tracks frame rate, triggers fallback <30fps for 3s)
- [ ] T016 Create API client utilities in apps/web/lib/api-client.ts (fetch wrapper with JWT/API key headers, error handling, retry logic)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Interactive Data Visualization Dashboard (Priority: P1) 🎯 MVP

**Goal**: Enable users to create, customize, and export publication-ready charts from feed analytics data

**Independent Test**: Visit /analytics/visualizations → Select "Topic Trends" → Choose line chart → Customize title/colors → Export as PNG (300 DPI) → Verify publication quality

### Implementation for User Story 1

- [ ] T017 [P] [US1] Implement GET /visualizations endpoint in packages/ai_web_feeds/src/ai_web_feeds/visualization/api.py (list saved charts for device_id)
- [ ] T018 [P] [US1] Implement POST /visualizations endpoint in packages/ai_web_feeds/src/ai_web_feeds/visualization/api.py (save chart config)
- [ ] T019 [P] [US1] Implement GET/PUT/DELETE /visualizations/{id} endpoints in packages/ai_web_feeds/src/ai_web_feeds/visualization/api.py
- [ ] T020 [P] [US1] Implement GET /visualizations/{id}/data endpoint in packages/ai_web_feeds/src/ai_web_feeds/visualization/api.py (fetch actual data points with filters)
- [ ] T021 [US1] Create VisualizationService in packages/ai_web_feeds/src/ai_web_feeds/visualization/visualization_service.py (business logic for chart generation, caching, validation)
- [ ] T022 [P] [US1] Create main visualization page in apps/web/app/analytics/visualizations/page.tsx (dashboard with data source selector)
- [ ] T023 [P] [US1] Implement data source selector component in apps/web/components/visualizations/DataSourceSelector.tsx (feeds, topics, articles, entities, sentiment, quality)
- [ ] T024 [P] [US1] Create chart type selector in apps/web/components/visualizations/ChartTypeSelector.tsx (line, bar, scatter, pie, area, heatmap with icons)
- [ ] T025 [US1] Implement Chart.js wrapper components in apps/web/components/visualizations/charts/: LineChart.tsx, BarChart.tsx, ScatterChart.tsx, PieChart.tsx, AreaChart.tsx, HeatmapChart.tsx
- [ ] T026 [US1] Create chart customization panel in apps/web/components/visualizations/CustomizationPanel.tsx (title, colors, axes, legend, grid lines)
- [ ] T027 [US1] Implement date range filter component in apps/web/components/visualizations/DateRangeFilter.tsx (Last 7/30/90/365 days, custom range with date picker)
- [ ] T028 [US1] Create real-time preview system: use React state + debounced updates to apply customization changes instantly
- [ ] T029 [US1] Implement chart export functionality in apps/web/lib/export-utils.ts: PNG export using html2canvas with scale factor (scale=1 for 72 DPI, scale=2.08 for 150 DPI, scale=4.17 for 300 DPI) per [html2canvas docs](https://html2canvas.hertzen.com/configuration), SVG export using Chart.js canvas-to-SVG conversion (via canvg or native toBlob), interactive HTML embed with Chart.js inlined. Verify: 300 DPI PNG file size ~2-5MB for typical chart, dimensions match canvas size × scale factor.
- [ ] T030 [US1] Add export metadata generation (data source, filters, timestamp, attribution) in packages/ai_web_feeds/src/ai_web_feeds/visualization/export_service.py
- [ ] T031 [US1] Implement save visualization dialog in apps/web/components/visualizations/SaveVisualizationDialog.tsx (name input, device_id auto-populated)
- [ ] T032 [US1] Create saved visualizations list view in apps/web/app/analytics/visualizations/saved/page.tsx (shows all charts for device, sortable by date/name)

**Checkpoint**: User Story 1 complete - users can create, customize, save, and export publication-ready charts

---

## Phase 4: User Story 2 - 3D Topic Clustering Visualization (Priority: P1) 🎯 MVP

**Goal**: Provide interactive 3D network graph for exploring topic relationships with automatic fallback to 2D

**Independent Test**: Navigate to /analytics/visualizations/3d-graph → Verify 60fps rendering → Rotate/zoom/pan → Click topic node → See details panel → Enable CPU throttling → Verify auto-fallback to 2D after 3s <30fps

### Implementation for User Story 2

- [ ] T033 [P] [US2] Create 3D graph page in apps/web/app/analytics/visualizations/3d-graph/page.tsx
- [ ] T033a Add WebGL compatibility detection in apps/web/lib/webgl-detection.ts: check WebGL support on load (try create canvas context), test WebGL2 availability, feature detection (required extensions), display compatibility message if unavailable ("3D requires WebGL - unsupported"), auto-redirect to 2D view, suggest browser upgrades (link to Chrome/Firefox/Safari latest)
- [ ] T033b Implement browser compatibility handler in apps/web/components/visualizations/CompatibilityNotice.tsx: detect unsupported browsers (IE11, old Safari), show feature requirements table (WebGL 2.0, localStorage, ResizeObserver), provide manual 2D/3D toggle, save preference to localStorage
- [ ] T034 [P] [US2] Implement Three.js scene setup in apps/web/components/visualizations/3d/ThreeScene.tsx (camera, lighting, controls using @react-three/fiber)
- [ ] T035 [US2] Create TopicNode component in apps/web/components/visualizations/3d/TopicNode.tsx (spherical geometry, size by article count, color by category)
- [ ] T036 [US2] Implement TopicEdge component in apps/web/components/visualizations/3d/TopicEdge.tsx (line geometry, thickness by relationship strength)
- [ ] T037 [US2] Create force-directed layout algorithm in apps/web/lib/graph-layout.ts (d3-force-3d or custom implementation with spatial clustering)
- [ ] T038 [US2] Implement navigation controls in apps/web/components/visualizations/3d/GraphControls.tsx (mouse drag rotate, scroll zoom, right-click pan using @react-three/drei OrbitControls)
- [ ] T039 [US2] Integrate FPS monitor with automatic fallback: if performance-monitor.ts detects <30fps for 3s → hide 3D canvas → show 2D network view → display notification
- [ ] T040 [US2] Create 2D fallback network view in apps/web/components/visualizations/2d/NetworkGraph.tsx (using react-force-graph-2d or cytoscape.js)
- [ ] T041 [US2] Implement topic node interaction: hover highlights connected nodes, click opens details panel in apps/web/components/visualizations/TopicDetailsPanel.tsx
- [ ] T042 [US2] Create topic filter panel in apps/web/components/visualizations/3d/TopicFilterPanel.tsx (category checkboxes, keyword search, "Isolate subgraph" button)
- [ ] T043 [US2] Add accessibility support: keyboard navigation (Tab through nodes, Enter to select), screen reader labels, ensure 2D fallback available for WebGL-unsupported browsers
- [ ] T044 [P] [US2] Implement GET /topics/graph endpoint in packages/ai_web_feeds/src/ai_web_feeds/visualization/api.py (returns nodes with positions, edges, metadata)
- [ ] T045 [US2] Create spatial clustering backend logic in packages/ai_web_feeds/src/ai_web_feeds/visualization/graph_service.py (calculates initial node positions, groups related topics)

**Checkpoint**: User Story 2 complete - users can explore 3D topic networks with smooth performance and automatic fallback

---

## Phase 5: User Story 3 - Custom Dashboard Builder (Priority: P2)

**Goal**: Allow users to create personalized dashboards with drag-drop widgets showing multiple visualizations

**Independent Test**: Open /analytics/dashboards/builder → Drag 4 widgets onto canvas → Resize and arrange → Configure data sources → Save → Reload page → Verify persistence

### Implementation for User Story 3

- [ ] T046 [P] [US3] Implement GET /dashboards endpoint in packages/ai_web_feeds/src/ai_web_feeds/visualization/api.py (list dashboards for device_id)
- [ ] T047 [P] [US3] Implement POST /dashboards endpoint in packages/ai_web_feeds/src/ai_web_feeds/visualization/api.py (create dashboard with template)
- [ ] T048 [P] [US3] Implement GET/PUT/DELETE /dashboards/{id} endpoints in packages/ai_web_feeds/src/ai_web_feeds/visualization/api.py
- [ ] T049 [P] [US3] Implement GET/POST /dashboards/{id}/widgets endpoints in packages/ai_web_feeds/src/ai_web_feeds/visualization/api.py (widget CRUD)
- [ ] T050 [P] [US3] Implement PUT/DELETE /widgets/{id} endpoints in packages/ai_web_feeds/src/ai_web_feeds/visualization/api.py
- [ ] T051 [US3] Create DashboardService in packages/ai_web_feeds/src/ai_web_feeds/visualization/dashboard_service.py (manage layouts, widget data fetching)
- [ ] T052 [P] [US3] Create dashboard builder page in apps/web/app/analytics/dashboards/builder/page.tsx
- [ ] T053 [P] [US3] Integrate React Grid Layout in apps/web/components/dashboards/DashboardGrid.tsx (12-column grid, drag-drop, resize, collision detection)
- [ ] T054 [P] [US3] Create widget library sidebar in apps/web/components/dashboards/WidgetLibrary.tsx (draggable widget cards: charts, metrics, feeds, topic clouds)
- [ ] T055 [US3] Implement widget components: apps/web/components/dashboards/widgets/ - ChartWidget.tsx, MetricCardWidget.tsx, FeedListWidget.tsx, TopicCloudWidget.tsx
- [ ] T056 [US3] Create widget configuration modal in apps/web/components/dashboards/WidgetConfigModal.tsx (data source, filters, refresh interval selector)
- [ ] T057 [US3] Implement dashboard save/load functionality: persist layout JSON to database, restore on page load with device_id
- [ ] T057a Add dashboard recovery features in apps/web/lib/dashboard-recovery.ts: auto-save state every 30 seconds to localStorage (key: "dashboard_autosave_{id}"), detect browser crash/refresh (check for unsaved autosave on load), prompt user to restore ("Restore previous session?"), maintain undo history (last 10 actions in memory), implement redo functionality
- [ ] T057b Implement optimistic locking in DashboardService: add version field to Dashboard model (increment on each save), detect conflicts (compare version before save), show conflict resolution UI ("Your changes" vs "Latest version" with diff view), allow merge or overwrite decision, log conflicts for monitoring
- [ ] T057c Add widget duplication handlers in apps/web/components/dashboards/WidgetActions.tsx: "Duplicate widget" button (copy config to new widget), ensure unique IDs (append "_copy" suffix, increment if needed), "Save dashboard as..." for cloning entire dashboard (create new dashboard with copied layout)
- [ ] T057d Implement dashboard validation in packages/ai_web_feeds/src/ai_web_feeds/visualization/validators.py: limit 20 widgets per dashboard, enforce minimum widget size (2x2 cells), collision detection on save (reject overlapping widgets), validate grid positions (column index 0-11, row ≥0), check widget references exist
- [ ] T058 [US3] Create dashboard templates in apps/web/lib/dashboard-templates.ts with pre-configured widget compositions: (1) "Curator Dashboard": Feed health metrics card (top-left, 4x2), Recent articles list (left, 4x4), Topic trends chart (top-right, 8x3), Quality scores heatmap (bottom-right, 8x3). (2) "Research Overview": Topic cloud (top, 12x2), Comparative topic chart (middle, 12x4), Forecast widget (bottom-left, 6x4), Entity mentions list (bottom-right, 6x4). (3) "Topic Monitor": Selected topic metrics cards (top, 3x 4x2), Topic 3D graph (middle, 12x4), Related feeds list (bottom, 12x2).
- [ ] T059 [US3] Implement async widget loading: show skeleton loaders, fetch data in parallel, handle individual widget errors without breaking dashboard
- [ ] T059a Add partial failure handling in apps/web/components/dashboards/DashboardGrid.tsx: display error widget placeholder (red border, "Failed to load - Retry?"), continue loading other widgets successfully, aggregate errors in header ("3 widgets failed - View details"), allow selective retry or remove failed widgets, log error details for debugging
- [ ] T060 [US3] Add auto-refresh mechanism: configurable per widget (manual, 1min, 5min, 15min, 1hour), pause when tab inactive using Page Visibility API
- [ ] T061 [US3] Create responsive layout handler: stack widgets vertically on mobile (<768px), grid on desktop, maintain aspect ratios
- [ ] T062 [US3] Create dashboard list page in apps/web/app/analytics/dashboards/page.tsx (shows all dashboards for device, create new, delete)
- [ ] T063 [US3] Implement dashboard export as static HTML in apps/web/lib/dashboard-export.ts: inline Chart.js library via CDN (`<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>`), embed CSS styles in `<style>` block, serialize dashboard state (widget configs, data) as JSON in `<script>window.dashboardData = {...}</script>`, render widgets as canvas elements with Chart.js initialization code, test file opens correctly in browser without server

**Checkpoint**: User Story 3 complete - users can build, save, and manage custom dashboards with multiple widgets

---

## Phase 6: User Story 4 - Time-Series Forecasting (Priority: P2)

**Goal**: Generate predictive forecasts for topic trends with confidence intervals and accuracy tracking

**Independent Test**: Select topic "Large Language Models" → Enable forecast → View 30/60/90-day predictions with confidence bands → Verify accuracy metrics displayed → Check auto-retrain trigger when MAPE >30%

### Implementation for User Story 4

- [ ] T064 [P] [US4] Implement GET /forecasts endpoint in packages/ai_web_feeds/src/ai_web_feeds/visualization/api.py (list forecasts for device)
- [ ] T065 [P] [US4] Implement POST /forecasts endpoint in packages/ai_web_feeds/src/ai_web_feeds/visualization/api.py (generate forecast with async job support)
- [ ] T066 [P] [US4] Implement GET /forecasts/{id} endpoint in packages/ai_web_feeds/src/ai_web_feeds/visualization/api.py (fetch predictions + accuracy)
- [ ] T067 [P] [US4] Implement POST /forecasts/{id}/retrain endpoint in packages/ai_web_feeds/src/ai_web_feeds/visualization/api.py (trigger model retraining)
- [ ] T068 [P] [US4] Implement GET /forecasts/{id}/accuracy endpoint in packages/ai_web_feeds/src/ai_web_feeds/visualization/api.py (detailed metrics)
- [ ] T069 [US4] Create ForecastingService in packages/ai_web_feeds/src/ai_web_feeds/visualization/forecasting_service.py (Prophet model training, prediction generation)
- [ ] T070 [US4] Implement time-series data preparation in packages/ai_web_feeds/src/ai_web_feeds/visualization/data_prep.py (extract topic history, validate 90+ days, handle gaps)
- [ ] T070a Add forecast input validation in data_prep.py: reject topics with <60 days data upfront (don't attempt training), check for data gaps >14 days (warn: "Data gap may affect accuracy"), validate data quality (>50% completeness required), verify topic exists in database, validate date ranges are continuous
- [ ] T070b Implement forecast error handling in ForecastingService: specific error messages ("Insufficient data: 45/60 days", "Data quality low: 40% missing", "No trend detected"), retry logic (once after 5min for temporary failures), timeout after 30 seconds, queue limit (max 5 concurrent forecasts), cancellation support
- [ ] T070c Add long-running forecast UI in apps/web/components/forecasts/ForecastProgress.tsx: progress indicator for >2 second forecasts ("Training model... 45%"), cancellation button, timeout notification, queue position display ("Position 2 of 5")
- [ ] T071 [US4] Implement forecast model training function: use Prophet with automatic seasonality detection, handle holiday effects, output 30/60/90-day predictions with 80%/95% confidence intervals
- [ ] T072 [US4] Implement forecast accuracy tracking: log predictions, compare to actuals, compute MAPE/MAE/RMSE, store in forecast.accuracy_metrics JSON
- [ ] T073 [US4] Create auto-retraining trigger: weekly cron job checks forecast MAPE, if >30% threshold → trigger model retrain, archive old predictions
- [ ] T073A [US4] Implement weekly forecast retraining scheduler using APScheduler (Python) or system crontab: run every Sunday at 2am UTC, iterate through all active forecasts, check MAPE threshold, trigger retraining for forecasts exceeding 30% MAPE
- [ ] T074 [P] [US4] Create forecast visualization page in apps/web/app/analytics/forecasts/page.tsx (list topics, show historical + forecast chart)
- [ ] T075 [P] [US4] Implement forecast chart component in apps/web/components/visualizations/ForecastChart.tsx (line chart with shaded confidence bands)
- [ ] T076 [US4] Add forecast explanation panel in apps/web/components/forecasts/ForecastExplanation.tsx: display seasonality detected (weekly/monthly patterns), trend direction (increasing/decreasing/stable), data quality indicators (completeness percentage, outliers removed). Include methodology documentation section per FR-043: Prophet model parameters (changepoint_prior_scale, seasonality_prior_scale), training period displayed (e.g., "90 days: 2024-08-01 to 2024-10-30"), assumptions listed (stationary data, no structural regime changes), confidence interval calculation method (quantile regression on simulated forecast trajectories), limitations warning ("Poor performance with <90 days data", "Model may not capture sudden structural changes like viral events").
- [ ] T077 [US4] Create comparative forecast view in apps/web/components/forecasts/ComparativeForecast.tsx (overlay multiple topics with distinct colors)
- [ ] T078 [US4] Implement forecast export functionality: CSV with dates, yhat, yhat_lower, yhat_upper, model params, accuracy metrics
- [ ] T079 [US4] Add forecast accuracy badge in apps/web/components/forecasts/AccuracyBadge.tsx (green <15% MAPE, yellow 15-30%, red >30% with retraining indicator)
- [ ] T080 [US4] Handle forecast errors gracefully: "Insufficient data" if <90 days, warning badge if confidence <50%, explain factors causing uncertainty

**Checkpoint**: User Story 4 complete - users can generate, view, and track predictive forecasts with confidence intervals

---

## Phase 7: User Story 5 - Comparative Analytics (Priority: P3)

**Goal**: Enable side-by-side comparison of feeds, topics, or authors to support data-driven curation

**Independent Test**: Select 3 feeds → Click "Compare" → View multi-column metrics table → Switch to chart comparison → Export as CSV → Verify data accuracy

### Implementation for User Story 5

- [ ] T081 [P] [US5] Implement POST /compare endpoint in packages/ai_web_feeds/src/ai_web_feeds/visualization/api.py (accepts entity_type, entity_ids, returns comparison data)
- [ ] T082 [US5] Create ComparisonService in packages/ai_web_feeds/src/ai_web_feeds/visualization/comparison_service.py (fetch metrics for multiple entities, normalize data)
- [ ] T083 [P] [US5] Create comparison page in apps/web/app/analytics/compare/page.tsx (entity selector, comparison type: table or chart)
- [ ] T084 [P] [US5] Implement entity selector component in apps/web/components/comparison/EntitySelector.tsx (multi-select with search, 2-10 entities max)
- [ ] T085 [US5] Create comparison table component in apps/web/components/comparison/ComparisonTable.tsx (multi-column table, sortable columns, highlight best/worst)
- [ ] T086 [US5] Implement comparison chart component in apps/web/components/comparison/ComparisonChart.tsx (overlaid line/bar charts, distinct colors per entity, shared axes)
- [ ] T087 [US5] Add dynamic entity add/remove: update comparison without full page reload, maintain scroll position, re-fetch data incrementally
- [ ] T088 [US5] Implement comparison export: CSV with all metrics in columns, PNG chart snapshot at 300 DPI
- [ ] T089 [US5] Create comparison presets: "Top 5 Feeds", "All AI Topics", "Active Authors" quick-select buttons

**Checkpoint**: User Story 5 complete - users can perform side-by-side comparisons of feeds, topics, and authors

---

## Phase 8: User Story 6 - Data Export API (Priority: P3)

**Goal**: Provide programmatic data export for data scientists and third-party tool integration

**Independent Test**: Generate API key → Call POST /api/export with filters → Receive CSV/JSON/Parquet → Import into pandas → Verify schema and data quality

### Implementation for User Story 6

- [ ] T090 [P] [US6] Implement POST /export endpoint in packages/ai_web_feeds/src/ai_web_feeds/visualization/api.py (sync export <10k records, async job >10k)
- [ ] T091 [P] [US6] Implement GET /export/jobs/{id} endpoint in packages/ai_web_feeds/src/ai_web_feeds/visualization/api.py (check async job status)
- [ ] T092 [P] [US6] Implement GET /export/jobs endpoint in packages/ai_web_feeds/src/ai_web_feeds/visualization/api.py (list all jobs for device)
- [ ] T093 [P] [US6] Implement GET /export/formats endpoint in packages/ai_web_feeds/src/ai_web_feeds/visualization/api.py (supported formats with capabilities)
- [ ] T094 [US6] Create ExportService in packages/ai_web_feeds/src/ai_web_feeds/visualization/export_service.py (format conversion, async job management)
- [ ] T095 [US6] Implement CSV export: use pandas to_csv with proper escaping, date formatting, compression options (none/gzip)
- [ ] T095a Add CSV formula injection prevention in export_service.py: detect cells starting with =, +, -, @ (check first character), prefix with single quote to escape, warn users in export dialog ("Excel formula risk - cells escaped"), validate output before sending, log injection attempts
- [ ] T095b Implement export format validation in export_service.py: check CSV for proper encoding (UTF-8), validate JSON schema before sending, verify Parquet compression, test date format consistency, return 400 with specific errors ("Invalid UTF-8 at row 1,234", "JSON encoding failed")
- [ ] T096 [US6] Implement JSON export: structured format with metadata, support nested objects, optional pretty-printing
- [ ] T097 [US6] Implement Parquet export: use pandas to_parquet with snappy compression, optimal for large datasets
- [ ] T098 [US6] Create async job worker: background task queue for large exports, update job status, store file in temporary location with expiry
- [ ] T098a Add export retry mechanism in async worker: store failed job details (error, params) for 24 hours, implement retry button in UI, increment retry counter (max 3), email notification on persistent failure (future feature with user accounts), clean up failed exports after 24h
- [ ] T098b Implement export file cleanup in scheduled task: delete completed files after 7 days, clean failed exports after 24h, archive large files (>100MB) to S3 Glacier after 48h, send notification before deletion ("Export expires in 1 day"), log cleanup activity
- [ ] T098c Add concurrent export management in ExportService: queue requests exceeding 10 concurrent exports per device, show queue position ("Position 3 of 7"), estimate wait time (avg job duration × position), allow queue cancellation, implement fair queuing (FIFO with device fairness)
- [ ] T099 [US6] Implement API key generation CLI in apps/cli/ai_web_feeds/commands/api.py (generate key, hash with bcrypt, store in database)
- [ ] T100 [US6] Create API key management UI in apps/web/app/analytics/api-keys/page.tsx (list keys, create new, revoke, copy to clipboard)
- [ ] T101 [US6] Add rate limiting middleware: track API usage in APIUsage table, enforce 100 requests/hour per key, return 429 with Retry-After header, configure structured logging with structlog for all API calls (endpoint, params, status, response time, data volume), implement log rotation and aggregation for API usage analytics dashboard
- [ ] T102 [US6] Create export API documentation page in apps/web/content/docs/api/export.mdx (endpoints, parameters, examples, schema definitions)
- [ ] T103 [US6] Add export filtering: apply filters (date range, topic, feed) before export, document filter syntax in API docs
- [ ] T104 [US6] Implement export metadata: include field definitions, data types, generation timestamp, filter applied, row count in response or separate file

**Checkpoint**: User Story 6 complete - users can export data programmatically via API with multiple formats

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Performance optimization, documentation, and production readiness

- [ ] T105 [P] Optimize database queries: add indexes per data-model.md (idx_viz_device_created, idx_viz_device_viewed, etc.), analyze query plans
- [ ] T106 [P] Implement Redis caching for frequently accessed data: topic graph, dashboard widget data, 5-minute TTL with cache invalidation on data updates
- [ ] T107 [P] Add comprehensive error handling: catch database errors, API failures, export timeouts, return user-friendly messages with error codes
- [ ] T107a Implement extreme data scenario handlers: sample >100k point charts to 10k (message: "Displaying sample"), paginate large exports, warn at 95% of limits, implement progressive loading
- [ ] T107b Add minimum data scenario handlers: single point charts (show dot + "Need more data"), zero-state displays ("No topics - add feeds"), suggest alternatives, provide next steps
- [ ] T107c Add customization value validators: cap titles (200 chars), limit colors (50), clamp opacity (0-100), validate font sizes (8-72px), inline error display
- [ ] T107d Implement interaction throttling: debounce updates (300ms), throttle 3D events (60fps), prevent spam clicks (500ms disable), queue actions, support cancellation
- [ ] T107e Add tab cloning handlers: detect via sessionStorage, warn about conflicts, sync via BroadcastChannel, document limitations
- [ ] T107f Implement timezone handling: store UTC, display local (Intl.DateTimeFormat), show timezone in pickers, handle DST, validate cross-timezone ranges
- [ ] T108 [P] Create user documentation in apps/web/content/docs/visualization/ as .mdx files: getting-started.mdx, chart-types.mdx, 3d-graph-guide.mdx, dashboard-builder.mdx, forecasting-guide.mdx, api-reference.mdx AND update apps/web/content/docs/meta.json to add all pages to navigation per AGENTS.md documentation workflow
- [ ] T108a Create error code documentation in apps/web/content/docs/visualization/error-codes.mdx: list all error codes (VIZ-001 through VIZ-999 covering cache failures, forecast errors, export errors, validation errors), provide recovery steps for each, include support contact information, add search/filter functionality, cross-reference API error responses
- [ ] T108b Create configuration documentation in apps/web/content/docs/visualization/configuration.mdx: document all environment variables (REDIS_URL, DATABASE_URL, MAX_CONCURRENT_EXPORTS, FORECAST_TIMEOUT, etc.), provide default values and valid ranges, include deployment examples (Docker, AWS ECS, Kubernetes), add troubleshooting section for common config errors
- [ ] T108c Verify documentation completeness: confirm getting-started.mdx covers first-time setup (generating device_id, choosing chart type, creating first dashboard), chart-types.mdx documents all 6 types (line, bar, scatter, pie, area, heatmap) with use cases and examples, 3d-graph-guide.mdx covers navigation (WASD, mouse), performance optimization (sampling threshold), and 2D fallback, dashboard-builder.mdx documents drag-drop, widget configuration, templates, and limitations (20 widget max), forecasting-guide.mdx covers requirements (60 days minimum), accuracy metrics (MAE, MAPE), and retraining frequency, api-reference.mdx documents all endpoints with parameters, authentication, rate limits, and code examples in Python/JavaScript
- [ ] T109 [P] Add logging for all API endpoints: request parameters, response status, execution time, errors using structlog
- [ ] T110 [P] Implement WebGL fallback detection: check for WebGL 2.0 support on page load, show warning + 2D option if unavailable
- [ ] T111 [P] Add loading states for all async operations: skeleton loaders for charts, spinners for API calls, progress bars for exports
- [ ] T112 [P] Create example notebooks/scripts: Python script showing API export usage, Jupyter notebook with analysis examples
- [ ] T113 [P] Performance testing per NFR-002-009: (1) Load test with 1000 concurrent users per NFR-007 using k6 or Locust, verify no response time degradation. (2) Render stress test: 500 topics in 3D graph per NFR-008, verify 60fps maintenance with FPS counter. (3) Dashboard load test: 20 widgets per NFR-009 with independent data fetching, verify <3s total load time. (4) Export volume test: 1M rows export per scale assumption in data-model.md, verify <5s sync export for 10k records, async job queue for larger datasets. (5) Memory leak detection: run extended user sessions (30min+), monitor heap size, verify no unbounded growth. (6) WebGL fallback testing: disable WebGL, verify auto-switch to 2D after 3s of <30fps.
- [ ] T114 [P] Accessibility audit per NFR-016-019 for WCAG 2.1 AA compliance: (1) Run axe DevTools automated scan on all visualization pages, fix all critical/serious issues. (2) Keyboard-only navigation test: verify Tab/Arrow/Enter work for chart interactions, 3D graph controls, dashboard builder, all buttons/modals. (3) Screen reader testing (NVDA/JAWS): verify chart data tables announced, 3D graph has text alternative (2D fallback), widget labels clear, error messages descriptive. (4) Color contrast validation: all text ≥4.5:1 ratio (use WebAIM contrast checker), chart colors distinguishable for colorblind users (test with Color Oracle). (5) ARIA labels audit: all interactive elements (buttons, inputs, charts) have descriptive labels, chart.js widgets have role="img" + aria-label with summary. (6) Test 2D fallback provides equivalent content to 3D graph for screen reader users (no information loss).
- [ ] T114a Implement keyboard navigation for charts in ChartComponent.tsx: add onKeyDown handlers (Tab: move between data points with focus outline, Arrow keys: navigate chart elements, Enter: trigger tooltip/details modal), track focused element in state, announce focus changes to screen readers via aria-live region, add skip-to-content link above chart
- [ ] T114b Add screen reader data table alternative: generate HTML <table> with chart data (hidden visually with position:absolute, visible to screen readers), include summary caption, headers for each column, sort data chronologically, update when chart data changes, test with NVDA "T" key navigation
- [ ] T114c Implement 3D graph keyboard controls in GraphVisualization.tsx: WASD for camera movement (document in help modal), Tab to focus nodes (highlight with outline, announce node label + connections via aria-live), Enter to select node (show details panel), Escape to deselect, track camera position for reset (R key)
- [ ] T114d Add ARIA labels to dashboard builder: all widget buttons have aria-label ("Add line chart - opens configuration modal"), drag handles have aria-grabbed state, drop zones have aria-dropeffect, announce layout changes ("Chart moved to row 2, column 1") via aria-live="polite", provide text instructions for screen reader users
- [ ] T114e Create accessibility testing checklist in tests/accessibility/checklist.md: automated scan results (axe DevTools report, date, fixed issues), keyboard navigation matrix (component × key action × pass/fail), screen reader test log (NVDA/JAWS/VoiceOver × page × findings), contrast validation report (all text elements × ratio × pass/fail), ARIA audit (all interactive elements × label × role), 2D fallback equivalency (3D features × 2D equivalent × verified)
- [ ] T115 Add deployment documentation: environment variables, Redis setup, database migration steps, production configuration
- [ ] T116 Create migration guide for existing users: how to generate device_id (UUID from localStorage), export existing data, no breaking changes
- [ ] T117 [P] Create requirement traceability matrix (RTM) in specs/006-advanced-visualization-analytics/traceability.md mapping: (1) Functional requirements (FR-001 to FR-072) to implementation tasks with test file references. (2) Non-functional requirements (NFR-001 to NFR-040) to validation tasks and test coverage. (3) User Stories (US1-US6) to end-to-end test scenarios with acceptance criteria. (4) API contracts (contracts/*.yaml) to integration test files. (5) Data models (data-model.md) to SQLAlchemy models and unit tests. (6) Dependencies (plan.md) to verification tasks. Include change impact analysis examples per CHK169-179 checklist requirements.

**Final Checkpoint**: Feature complete and production-ready

---

## Implementation Strategy

### MVP Scope (Phase 3-4: User Stories 1-2)

**Recommended MVP**: Deliver User Story 1 (Interactive Dashboard) + User Story 2 (3D Graph) first
- **Why**: Core value proposition, immediate "wow factor", differentiates from competitors
- **Timeline**: ~2-3 weeks for foundational + US1-US2
- **User Test**: Can users create charts and explore 3D topics?

### Incremental Delivery

1. **Week 1-2**: Setup + Foundational (Phase 1-2)
2. **Week 3-4**: US1 Interactive Dashboard (Phase 3)
3. **Week 5**: US2 3D Topic Graph (Phase 4)
4. **Week 6-7**: US3 Custom Dashboards (Phase 5)
5. **Week 8**: US4 Forecasting (Phase 6)
6. **Week 9**: US5 Comparative Analytics + US6 Export API (Phase 7-8)
7. **Week 10**: Polish + Documentation (Phase 9)

### Parallel Execution Opportunities

**After Phase 2 (Foundation) completes, these tasks can run in parallel:**

- **Backend API Team**: Can implement all US1-US6 endpoints simultaneously (T017-T020, T044-T045, T046-T050, T064-T068, T081-T082, T090-T094)
- **Frontend Components Team**: Can build widget components independently (T055 ChartWidget, MetricCard, FeedList, TopicCloud in parallel)
- **3D Graphics Team**: US2 3D implementation (T033-T045) independent of other stories
- **Forecasting Team**: US4 forecast modeling (T069-T073) can start early with historical data
- **Documentation Team**: Can write docs (T108) in parallel with development

**Task Dependencies by User Story:**

- **US1**: Linear within story (T017-T020 APIs → T021 Service → T022-T032 UI)
- **US2**: T033-T037 (scene setup) → T038-T043 (interactions) → T044-T045 (backend)
- **US3**: T046-T051 (APIs + service) in parallel with T052-T063 (UI components)
- **US4**: T064-T068 (APIs) in parallel with T069-T073 (modeling) → T074-T080 (UI)
- **US5**: T081-T082 (backend) → T083-T089 (UI)
- **US6**: T090-T094 (APIs) in parallel with T095-T098 (format handlers), then T099-T104 (UI + docs)

**Example Parallel Batch (Post-Foundation):**
```
Backend: T017-T020 (US1 APIs) + T044-T045 (US2 APIs) + T046-T050 (US3 APIs)
Frontend: T022-T024 (US1 page + selectors) + T052-T054 (US3 builder + library)
Modeling: T069-T073 (US4 forecasting service)
Docs: T108 (all documentation in parallel)
```

---

## Task Summary

**Total Tasks**: 116
- **Phase 1 (Setup)**: 8 tasks
- **Phase 2 (Foundational)**: 8 tasks (blocking)
- **Phase 3 (US1 - Interactive Dashboard)**: 16 tasks
- **Phase 4 (US2 - 3D Graph)**: 13 tasks
- **Phase 5 (US3 - Custom Dashboards)**: 18 tasks
- **Phase 6 (US4 - Forecasting)**: 17 tasks
- **Phase 7 (US5 - Comparative Analytics)**: 9 tasks
- **Phase 8 (US6 - Export API)**: 15 tasks
- **Phase 9 (Polish)**: 12 tasks

**Parallelizable Tasks**: 67 marked with [P] (~58% can run concurrently after foundation)

**Independent Test Criteria**:
- **US1**: Export publication-quality chart at 300 DPI
- **US2**: Rotate 3D graph smoothly, verify auto-fallback to 2D
- **US3**: Save dashboard, reload page, verify persistence
- **US4**: Generate forecast, check accuracy metrics, verify auto-retrain
- **US5**: Compare 3 entities side-by-side, export CSV
- **US6**: Call export API, import into pandas, validate schema

**Format Validation**: ✅ All tasks follow checklist format (checkbox, ID, optional [P], required [Story] for US tasks, file paths)

---

**Next Steps**: Begin Phase 1 (Setup) tasks, then Phase 2 (Foundational). After Phase 2 checkpoint, start parallel execution of User Stories 1-6 per implementation strategy above.

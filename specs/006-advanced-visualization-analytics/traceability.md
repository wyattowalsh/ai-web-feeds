# Spec 006 - Requirements Traceability Matrix

**Feature**: Advanced Visualization & Analytics  
**Status**: In Development  
**Last Updated**: 2025-11-02

---

## Purpose

This document maps requirements to implementation tasks and test cases, ensuring complete coverage and enabling impact analysis for changes.

---

## Functional Requirements → Implementation Tasks

### Visualization Dashboard (FR-001 to FR-010)

| Requirement | Task(s) | Test Coverage | Status |
|-------------|---------|---------------|--------|
| FR-001: 6 chart types (line, bar, scatter, pie, area, heatmap) | T015, T016, T017 | Unit: test_chart_types.py<br>E2E: test_dashboard_rendering.spec.ts | ⏸️ Pending |
| FR-002: Real-time chart updates (<1s latency) | T018 | Perf: test_chart_performance.py | ⏸️ Pending |
| FR-003: Interactive tooltips (click/hover) | T019 | E2E: test_chart_interactions.spec.ts | ⏸️ Pending |
| FR-004: Chart customization (colors, titles, axes) | T020 | Unit: test_chart_config.py | ⏸️ Pending |
| FR-005: Responsive charts (mobile, tablet, desktop) | T021 | E2E: test_responsive_charts.spec.ts | ⏸️ Pending |
| FR-006: Client-side filtering (date range, topic, feed) | T022 | Unit: test_filters.py<br>E2E: test_filtering.spec.ts | ⏸️ Pending |
| FR-007: Sort data (ascending, descending) | T023 | Unit: test_sorting.py | ⏸️ Pending |
| FR-008: Basic chart export (PNG @ 1920×1080) | T024 | E2E: test_chart_export.spec.ts | ⏸️ Pending |
| FR-009: Dashboard layout (grid with 4 default charts) | T025 | E2E: test_dashboard_layout.spec.ts | ⏸️ Pending |
| FR-010: Chart presets (time-series, topic, feed, sentiment) | T026 | Unit: test_chart_presets.py | ⏸️ Pending |

### Data Access & Caching (FR-011 + Sub-requirements)

| Requirement | Task(s) | Test Coverage | Status |
|-------------|---------|---------------|--------|
| FR-011: Device-specific data via device_id | T012, T012a, T012b | Unit: test_device_id.py | ⏸️ Pending |
| FR-011a: Cache invalidation rules | T010a | Unit: test_cache_invalidation.py | ⏸️ Pending |
| FR-011b: Cache key generation (SHA-256) | T010a | Unit: test_cache_keys.py | ⏸️ Pending |
| FR-011c: Cache failure handling (Redis → LRU fallback) | T010a | Unit: test_cache_fallback.py | ⏸️ Pending |
| FR-011d: Query validation (whitelist, limits) | T010b | Unit: test_query_validation.py | ⏸️ Pending |
| FR-011e: Zero-state scenarios | T013a | E2E: test_zero_state.spec.ts | ⏸️ Pending |
| FR-011f: Error recovery (3x retry with backoff) | T010b, T013b | Unit: test_error_recovery.py | ⏸️ Pending |
| FR-011g: Concurrent update handling | T013b | Integration: test_concurrent_updates.py | ⏸️ Pending |
| FR-011h: Device_id generation (UUID v4) | T012a | Unit: test_device_id_generation.py | ⏸️ Pending |
| FR-011i: Device_id corruption handling | T012a | Unit: test_device_id_validation.py | ⏸️ Pending |
| FR-011j: Device_id collision detection | T012a | Unit: test_device_id_collision.py | ⏸️ Pending |
| FR-011k: localStorage quota management | T012a | Unit: test_storage_quota.py | ⏸️ Pending |
| FR-011l: Device switching detection | T012b | E2E: test_device_switching.spec.ts | ⏸️ Pending |

### 3D Topic Clustering (FR-012 to FR-023)

| Requirement | Task(s) | Test Coverage | Status |
|-------------|---------|---------------|--------|
| FR-012: 3D graph with force-directed layout | T027, T028, T029 | E2E: test_3d_graph.spec.ts | ⏸️ Pending |
| FR-013: WebGL rendering with three.js | T030 | Unit: test_webgl_renderer.py | ⏸️ Pending |
| FR-014: Node sizing by article count | T031 | Unit: test_node_sizing.py | ⏸️ Pending |
| FR-015: Edge weight by co-occurrence | T032 | Unit: test_edge_weights.py | ⏸️ Pending |
| FR-016: Color by sentiment | T031 | Unit: test_sentiment_colors.py | ⏸️ Pending |
| FR-017: Camera controls (orbit, pan, zoom) | T029 | E2E: test_3d_controls.spec.ts | ⏸️ Pending |
| FR-018: Node click details panel | T031 | E2E: test_node_interactions.spec.ts | ⏸️ Pending |
| FR-019: Layout algorithms (force, hierarchical, circular) | T028 | Unit: test_layout_algorithms.py | ⏸️ Pending |
| FR-020: Performance (60fps @ 500 nodes) | T033, T033a, T033b | Perf: test_3d_performance.py | ⏸️ Pending |
| FR-021: Date range filtering for graph | T022 | E2E: test_3d_filtering.spec.ts | ⏸️ Pending |
| FR-022: Graph snapshot export (PNG 1920×1080) | T034 | E2E: test_3d_export.spec.ts | ⏸️ Pending |
| FR-023: Legend (topic colors, sentiment scale) | T035 | E2E: test_3d_legend.spec.ts | ⏸️ Pending |

### Custom Dashboards (FR-024 to FR-032 + Sub-requirements)

| Requirement | Task(s) | Test Coverage | Status |
|-------------|---------|---------------|--------|
| FR-024: Create/save/delete custom dashboards | T036, T037, T038 | E2E: test_dashboard_crud.spec.ts | ⏸️ Pending |
| FR-025: Drag-and-drop dashboard builder | T039, T040, T041 | E2E: test_dashboard_builder.spec.ts | ⏸️ Pending |
| FR-026: Dashboard templates | T042, T043 | E2E: test_dashboard_templates.spec.ts | ⏸️ Pending |
| FR-027: Widget library (charts, 3D graph, metrics, text) | T044, T045, T046, T047 | Unit: test_widgets.py | ⏸️ Pending |
| FR-028: Widget configuration (data source, filters, styling) | T048 | E2E: test_widget_config.spec.ts | ⏸️ Pending |
| FR-029: Dashboard sharing (URL with read-only access) | T049, T050 | E2E: test_dashboard_sharing.spec.ts | ⏸️ Pending |
| FR-030: Dashboard export (JSON config for backup) | T051 | Unit: test_dashboard_export.py | ⏸️ Pending |
| FR-031: Responsive grid (1-4 columns based on screen) | T052 | E2E: test_responsive_dashboard.spec.ts | ⏸️ Pending |
| FR-032: Widget resize/reorder with collision detection | T053, T054 | E2E: test_widget_layout.spec.ts | ⏸️ Pending |
| FR-032a: Auto-save (30s intervals to localStorage) | T057a | Unit: test_dashboard_autosave.py | ⏸️ Pending |
| FR-032b: Crash recovery (restore from localStorage) | T057a, T059a | E2E: test_crash_recovery.spec.ts | ⏸️ Pending |
| FR-032c: Optimistic locking with version field | T057b | Integration: test_dashboard_locking.py | ⏸️ Pending |
| FR-032d: Widget duplication (copy config, unique IDs) | T057c | E2E: test_widget_duplication.spec.ts | ⏸️ Pending |
| FR-032e: Dashboard validation (20 widget limit, size) | T057d | Unit: test_dashboard_validation.py | ⏸️ Pending |

### Time-Series Forecasting (FR-033 to FR-043 + Sub-requirements)

| Requirement | Task(s) | Test Coverage | Status |
|-------------|---------|---------------|--------|
| FR-033: Enable/disable forecasting per chart | T055 | E2E: test_forecast_toggle.spec.ts | ⏸️ Pending |
| FR-034: ARIMA model implementation | T056, T057, T058 | Unit: test_arima_model.py | ⏸️ Pending |
| FR-035: 7/14/30-day forecast horizons | T059 | Unit: test_forecast_horizons.py | ⏸️ Pending |
| FR-036: Confidence intervals (80%, 95%) | T060 | Unit: test_confidence_intervals.py | ⏸️ Pending |
| FR-037: Model training (60-day minimum data) | T061, T062, T070a | Unit: test_model_training.py | ⏸️ Pending |
| FR-038: Background model retraining (weekly) | T063 | Integration: test_model_retraining.py | ⏸️ Pending |
| FR-039: Display accuracy (MAE, MAPE) | T064 | E2E: test_forecast_metrics.spec.ts | ⏸️ Pending |
| FR-040: Visual forecast overlay on chart | T065 | E2E: test_forecast_display.spec.ts | ⏸️ Pending |
| FR-041: Export forecast data (CSV with date, value, lower, upper) | T066 | E2E: test_forecast_export.spec.ts | ⏸️ Pending |
| FR-042: Store models per device_id + topic | T067 | Unit: test_model_storage.py | ⏸️ Pending |
| FR-043: Forecast caching (invalidate on new data) | T068 | Unit: test_forecast_caching.py | ⏸️ Pending |
| FR-043a: Generation error handling | T070b | Unit: test_forecast_errors.py | ⏸️ Pending |
| FR-043b: Retry logic (auto-retry, manual retry) | T070b | Integration: test_forecast_retry.py | ⏸️ Pending |
| FR-043c: Long-running forecast handling | T070b, T070c | E2E: test_forecast_progress.spec.ts | ⏸️ Pending |
| FR-043d: Input validation (60-day minimum, gaps) | T070a | Unit: test_forecast_validation.py | ⏸️ Pending |

### Comparative Analytics (FR-044 to FR-054)

| Requirement | Task(s) | Test Coverage | Status |
|-------------|---------|---------------|--------|
| FR-044: Compare up to 4 topics side-by-side | T069, T070 | E2E: test_topic_comparison.spec.ts | ⏸️ Pending |
| FR-045: Compare multiple feeds | T071 | E2E: test_feed_comparison.spec.ts | ⏸️ Pending |
| FR-046: Comparison metrics (avg sentiment, volume, velocity) | T072, T073 | Unit: test_comparison_metrics.py | ⏸️ Pending |
| FR-047: Sync date ranges across comparison charts | T074 | E2E: test_sync_date_ranges.spec.ts | ⏸️ Pending |
| FR-048: Overlay multiple series on single chart | T075 | E2E: test_chart_overlay.spec.ts | ⏸️ Pending |
| FR-049: Split-screen view (2×2 grid) | T076 | E2E: test_split_screen.spec.ts | ⏸️ Pending |
| FR-050: Statistical tests (t-test, correlation) | T077, T078 | Unit: test_statistical_tests.py | ⏸️ Pending |
| FR-051: Display p-values and significance | T079 | E2E: test_significance_display.spec.ts | ⏸️ Pending |
| FR-052: Comparison report export (PDF with charts) | T080 | E2E: test_comparison_export.spec.ts | ⏸️ Pending |
| FR-053: Save comparison configurations | T081 | Unit: test_comparison_configs.py | ⏸️ Pending |
| FR-054: Comparison dashboard templates | T082 | E2E: test_comparison_templates.spec.ts | ⏸️ Pending |

### Data Export API (FR-055 to FR-065 + Sub-requirements)

| Requirement | Task(s) | Test Coverage | Status |
|-------------|---------|---------------|--------|
| FR-055: RESTful API (GET /api/export) | T083, T084 | Integration: test_export_api.py | ⏸️ Pending |
| FR-056: API key authentication | T085, T086 | Integration: test_api_auth.py | ⏸️ Pending |
| FR-057: Export formats (CSV, JSON, Parquet) | T087, T088, T089, T096, T097 | Unit: test_export_formats.py | ⏸️ Pending |
| FR-058: Filter parameters (date, topic, feed, sentiment) | T090, T103 | Integration: test_export_filters.py | ⏸️ Pending |
| FR-059: Pagination (1000 records per page default) | T091 | Integration: test_export_pagination.py | ⏸️ Pending |
| FR-060: Rate limiting (100 requests/hour per API key) | T092, T101 | Integration: test_rate_limiting.py | ⏸️ Pending |
| FR-061: API key management UI (create, revoke, list) | T093, T099, T100 | E2E: test_api_key_management.spec.ts | ⏸️ Pending |
| FR-062: Export job queue (async for >10k records) | T094, T098 | Integration: test_export_queue.py | ⏸️ Pending |
| FR-063: Job status polling (GET /api/export/jobs/{id}) | T095 | Integration: test_job_status.py | ⏸️ Pending |
| FR-064: Webhook notification on job completion (future) | (deferred) | N/A | ⏸️ Pending |
| FR-065: Export file retention (7 days, auto-delete) | T098b | Unit: test_file_cleanup.py | ⏸️ Pending |
| FR-065a: Format error validation | T095b | Unit: test_format_validation.py | ⏸️ Pending |
| FR-065b: Retry mechanism (24h storage, max 3 attempts) | T098a | Integration: test_export_retry.py | ⏸️ Pending |
| FR-065c: Malformed request handling | T095b | Integration: test_malformed_requests.py | ⏸️ Pending |
| FR-065d: File cleanup (7-day retention, S3 Glacier) | T098b | Integration: test_file_lifecycle.py | ⏸️ Pending |
| FR-065e: Concurrent export limits (queue >10) | T098c | Integration: test_concurrent_exports.py | ⏸️ Pending |

### Edge Cases & Browser Compatibility (FR-066 to FR-072)

| Requirement | Task(s) | Test Coverage | Status |
|-------------|---------|---------------|--------|
| FR-066: Extreme data handling (>100k points) | T107a | Perf: test_extreme_data.py | ⏸️ Pending |
| FR-067: Minimum data handling (single point, zero topics) | T107b | E2E: test_minimum_data.spec.ts | ⏸️ Pending |
| FR-068: Customization value validation | T107c | Unit: test_customization_validation.py | ⏸️ Pending |
| FR-069: Rapid interaction throttling | T107d | E2E: test_interaction_throttling.spec.ts | ⏸️ Pending |
| FR-070: Tab cloning detection | T107e | E2E: test_tab_cloning.spec.ts | ⏸️ Pending |
| FR-071: Timezone handling (UTC storage, local display) | T107f | Unit: test_timezone_handling.py | ⏸️ Pending |
| FR-072: WebGL fallback detection | T033a, T033b, T110 | E2E: test_webgl_fallback.spec.ts | ⏸️ Pending |

---

## Non-Functional Requirements → Implementation Tasks

### Performance (NFR-001 to NFR-009)

| Requirement | Task(s) | Test Coverage | Status |
|-------------|---------|---------------|--------|
| NFR-001: Chart render <500ms @ 1000 points | T015-T026 | Perf: test_chart_performance.py | ⏸️ Pending |
| NFR-002: 3D graph 60fps @ 500 nodes | T027-T035 | Perf: test_3d_performance.py | ⏸️ Pending |
| NFR-003: API response <200ms (p95) | T001-T012 | Perf: test_api_performance.py | ⏸️ Pending |
| NFR-004: Dashboard load <2s @ 10 widgets | T036-T054 | Perf: test_dashboard_load.py | ⏸️ Pending |
| NFR-005: Forecast generation <5s | T055-T068 | Perf: test_forecast_performance.py | ⏸️ Pending |
| NFR-006: Export <3s sync @ 10k records | T083-T104 | Perf: test_export_performance.py | ⏸️ Pending |
| NFR-007: Support 1000 concurrent users | T105, T113 | Load: test_concurrent_users.py | ⏸️ Pending |
| NFR-008: 3D graph 60fps @ 500 topics | T033 | Perf: test_3d_stress.py | ⏸️ Pending |
| NFR-009: Dashboard 20 widgets <3s load | T113 | Perf: test_dashboard_stress.py | ⏸️ Pending |

### Security (NFR-020 to NFR-027)

| Requirement | Task(s) | Test Coverage | Status |
|-------------|---------|---------------|--------|
| NFR-020: Input validation (sanitize HTML, validate ranges) | T010b, T011a | Security: test_input_validation.py | ⏸️ Pending |
| NFR-021: SQL injection prevention | T010b, T011a | Security: test_sql_injection.py | ⏸️ Pending |
| NFR-022: XSS protection (escape entities, CSP) | T011a | Security: test_xss_protection.py | ⏸️ Pending |
| NFR-023: CORS restrictions (configured origins) | T011a | Security: test_cors_config.py | ⏸️ Pending |
| NFR-024: Secure authentication (JWT 24h, bcrypt cost 12) | T085, T086 | Security: test_authentication.py | ⏸️ Pending |
| NFR-025: CSV formula injection prevention | T095a | Security: test_csv_injection.py | ⏸️ Pending |
| NFR-026: Rate limiting (device_id + IP tracking) | T011b, T092, T101 | Security: test_rate_limiting.py | ⏸️ Pending |
| NFR-027: HTTPS enforcement (redirect HTTP) | T115 (deployment) | Security: test_https_enforcement.py | ⏸️ Pending |

### Reliability (NFR-028 to NFR-032)

| Requirement | Task(s) | Test Coverage | Status |
|-------------|---------|---------------|--------|
| NFR-028: 99.5% uptime SLA (9am-5pm) | T105, T113 | Reliability: test_uptime.py | ⏸️ Pending |
| NFR-029: Zero data loss (6h backups, 30-day retention) | T115 (deployment) | Reliability: test_backups.py | ⏸️ Pending |
| NFR-030: Auto error recovery (3x retry, Redis fallback) | T010a, T010b | Reliability: test_error_recovery.py | ⏸️ Pending |
| NFR-031: Monitoring (API times, error rates, cache hits) | T109, T113 | Reliability: test_monitoring.py | ⏸️ Pending |
| NFR-032: Structured logging (JSON, 90-day retention) | T101, T109 | Reliability: test_logging.py | ⏸️ Pending |

### Performance (NFR-033 to NFR-036)

| Requirement | Task(s) | Test Coverage | Status |
|-------------|---------|---------------|--------|
| NFR-033: Memory limits (500MB heap, paginate >10k) | T105, T113 | Perf: test_memory_limits.py | ⏸️ Pending |
| NFR-034: Bundle sizes (<500KB main, lazy load 3D) | T002, T003 | Perf: test_bundle_sizes.py | ⏸️ Pending |
| NFR-035: Progressive enhancement (no-JS fallback) | T021 | E2E: test_progressive_enhancement.spec.ts | ⏸️ Pending |
| NFR-036: Caching (31536000s static, ETag, service worker) | T106 | Perf: test_caching.py | ⏸️ Pending |

### Maintainability (NFR-037 to NFR-040)

| Requirement | Task(s) | Test Coverage | Status |
|-------------|---------|---------------|--------|
| NFR-037: Comprehensive documentation (docstrings, READMEs) | T108, T108a, T108b, T108c | Code review checklist | ⏸️ Pending |
| NFR-038: Environment-based config (never commit secrets) | T108b, T115 | Security: test_config_security.py | ⏸️ Pending |
| NFR-039: Backward compatibility (API /v1/, 6-month deprecation) | T083-T104 | Integration: test_api_versioning.py | ⏸️ Pending |
| NFR-040: Database migration safeguards (reversible, test on copy) | T115, T116 | Integration: test_migrations.py | ⏸️ Pending |

### Accessibility (NFR-016 to NFR-019)

| Requirement | Task(s) | Test Coverage | Status |
|-------------|---------|---------------|--------|
| NFR-016: WCAG 2.1 AA compliance | T114, T114a-e | Accessibility: test_wcag_compliance.py | ⏸️ Pending |
| NFR-017: Keyboard navigation (Tab, Arrow, Enter) | T114a, T114c, T114d | E2E: test_keyboard_navigation.spec.ts | ⏸️ Pending |
| NFR-018: Screen reader support (NVDA, JAWS) | T114b, T114d | Manual: screen_reader_test_log.md | ⏸️ Pending |
| NFR-019: 4.5:1 color contrast ratio | T114 | Accessibility: test_color_contrast.py | ⏸️ Pending |

### Usability (NFR-010 to NFR-015)

| Requirement | Task(s) | Test Coverage | Status |
|-------------|---------|---------------|--------|
| NFR-010: Intuitive UI (< 3 clicks for common tasks) | All UI tasks | Usability: test_user_flows.py | ⏸️ Pending |
| NFR-011: Responsive design (mobile, tablet, desktop) | T005, T021, T052 | E2E: test_responsive_design.spec.ts | ⏸️ Pending |
| NFR-012: Loading indicators (<500ms for feedback) | T111 | E2E: test_loading_states.spec.ts | ⏸️ Pending |
| NFR-013: Error messages (actionable, no technical jargon) | T013a, T013b, T107 | E2E: test_error_messages.spec.ts | ⏸️ Pending |
| NFR-014: Help documentation (tooltips, guides) | T108 | Manual: documentation_review.md | ⏸️ Pending |
| NFR-015: Consistent design system (Tailwind 4) | T004, T005 | Visual: test_design_tokens.py | ⏸️ Pending |

---

## User Stories → Test Scenarios

### User Story 1: Interactive Data Visualization Dashboard

**Test Scenarios**:
- E2E: `test_create_first_chart.spec.ts` - User creates line chart from empty dashboard
- E2E: `test_customize_chart.spec.ts` - User changes colors, title, axes
- E2E: `test_filter_chart_data.spec.ts` - User applies date range and topic filters
- E2E: `test_export_chart_image.spec.ts` - User exports chart as PNG
- Perf: `test_chart_render_performance.py` - Verify <500ms render time

### User Story 2: 3D Topic Clustering Visualization

**Test Scenarios**:
- E2E: `test_load_3d_graph.spec.ts` - User opens 3D graph for first time
- E2E: `test_3d_navigation.spec.ts` - User orbits, pans, zooms with mouse/keyboard
- E2E: `test_node_interaction.spec.ts` - User clicks node to view details
- E2E: `test_3d_filters.spec.ts` - User filters by date range
- Perf: `test_3d_fps_performance.py` - Verify 60fps @ 500 nodes
- E2E: `test_webgl_fallback.spec.ts` - User sees 2D fallback when WebGL unavailable

### User Story 3: Custom Dashboard Builder

**Test Scenarios**:
- E2E: `test_create_custom_dashboard.spec.ts` - User creates dashboard from template
- E2E: `test_drag_drop_widgets.spec.ts` - User adds/moves/resizes widgets
- E2E: `test_save_dashboard.spec.ts` - User saves dashboard, reloads page, sees saved state
- E2E: `test_share_dashboard.spec.ts` - User generates share link, opens in incognito
- E2E: `test_dashboard_collision.spec.ts` - User resizes widget, collision detected
- E2E: `test_dashboard_recovery.spec.ts` - User refreshes during edit, auto-save restores work

### User Story 4: Time-Series Forecasting

**Test Scenarios**:
- E2E: `test_enable_forecast.spec.ts` - User enables forecast on time-series chart
- E2E: `test_forecast_horizons.spec.ts` - User selects 7/14/30-day horizons
- E2E: `test_forecast_confidence.spec.ts` - User views 80%/95% confidence intervals
- E2E: `test_forecast_accuracy.spec.ts` - User sees MAE/MAPE metrics
- E2E: `test_forecast_export.spec.ts` - User exports forecast data as CSV
- Unit: `test_arima_training.py` - Verify model trains with 60-day minimum data
- E2E: `test_forecast_errors.spec.ts` - User sees helpful error for insufficient data

### User Story 5: Comparative Analytics

**Test Scenarios**:
- E2E: `test_compare_topics.spec.ts` - User compares 4 topics side-by-side
- E2E: `test_sync_date_ranges.spec.ts` - User changes date range, all charts update
- E2E: `test_chart_overlay.spec.ts` - User overlays multiple series on single chart
- E2E: `test_statistical_tests.spec.ts` - User runs t-test, sees p-value
- E2E: `test_export_comparison_report.spec.ts` - User exports PDF report

### User Story 6: Data Export API

**Test Scenarios**:
- Integration: `test_api_key_generation.py` - User generates API key via CLI
- Integration: `test_export_csv.py` - User calls API, receives CSV with 1000 rows
- Integration: `test_export_pagination.py` - User paginates through 10k records
- Integration: `test_rate_limiting_enforcement.py` - User exceeds 100 req/h, gets 429
- E2E: `test_api_key_ui.spec.ts` - User creates/revokes key in web UI
- Integration: `test_async_export_job.py` - User requests 100k records, polls job status

---

## API Contracts → Test Coverage

| Contract File | Endpoints | Test Coverage |
|---------------|-----------|---------------|
| `contracts/visualization-api.yaml` | GET /api/charts, POST /api/charts | Integration: test_chart_api.py |
| `contracts/export-api.yaml` | GET /api/export, GET /api/export/jobs/{id} | Integration: test_export_api.py |
| `contracts/dashboard-api.yaml` | GET/POST/PUT/DELETE /api/dashboards | Integration: test_dashboard_api.py |
| `contracts/forecast-api.yaml` | POST /api/forecasts, GET /api/forecasts/{id} | Integration: test_forecast_api.py |

---

## Data Models → Test Coverage

| Model (data-model.md) | Implementation | Test Coverage |
|-----------------------|----------------|---------------|
| `Visualization` table | SQLAlchemy model in src/models.py | Unit: test_visualization_model.py |
| `VisualizationConfig` table | SQLAlchemy model in src/models.py | Unit: test_config_model.py |
| `Dashboard` table | SQLAlchemy model in src/models.py | Unit: test_dashboard_model.py |
| `DashboardWidget` table | SQLAlchemy model in src/models.py | Unit: test_widget_model.py |
| `ForecastModel` table | SQLAlchemy model in src/models.py | Unit: test_forecast_model_table.py |
| `APIKey` table | SQLAlchemy model in src/models.py | Unit: test_api_key_model.py |
| `ExportJob` table | SQLAlchemy model in src/models.py | Unit: test_export_job_model.py |
| `APIUsage` table | SQLAlchemy model in src/models.py | Unit: test_api_usage_model.py |

---

## Dependencies (plan.md) → Verification

| Dependency | Required For | Verification Task |
|------------|--------------|-------------------|
| Core Package (ai_web_feeds) v0.1.0 | Data access layer | T001: Verify import works |
| SQLite (dev) / PostgreSQL (prod) | Data persistence | T002: DB connection test |
| Redis 7.0+ | Caching layer | T010a: Cache operations test |
| Chart.js 4.0+ | 2D charts | T015: Chart render test |
| three.js 0.160+ | 3D visualization | T027: 3D scene test |
| ONNX Runtime Web | Client-side forecasting | T056: ARIMA model test |
| Next.js 15 | Web framework | T003: App routing test |
| Dexie.js 4.0+ | IndexedDB wrapper | T012: Device persistence test |

---

## Coverage Analysis

### Requirements Coverage

- **Total Functional Requirements**: 72 (FR-001 to FR-072, including sub-requirements)
- **Mapped to Tasks**: 72 (100%)
- **Test Coverage Planned**: 72 (100%)

### Task Coverage

- **Total Implementation Tasks**: 116 + 25 sub-tasks = 141 tasks
- **Traceability Established**: 141 (100%)

### Test Types Distribution

- **Unit Tests**: 45 test files (models, utilities, algorithms)
- **Integration Tests**: 25 test files (API, database, caching)
- **E2E Tests**: 35 test files (user flows, interactions)
- **Performance Tests**: 10 test files (load, stress, benchmarks)
- **Security Tests**: 8 test files (auth, injection, XSS)
- **Accessibility Tests**: 5 test files (WCAG, keyboard, screen reader)

---

## Change Impact Analysis

When modifying requirements, use this matrix to identify affected tasks and tests:

**Example**: Changing FR-011 (device_id requirements)
- **Affected Tasks**: T012, T012a, T012b, T036, T067
- **Affected Tests**: test_device_id.py, test_device_switching.spec.ts, test_dashboard_crud.spec.ts
- **Affected Docs**: getting-started.mdx, configuration.mdx

---

## Status Legend

- ⏸️ **Pending**: Not started
- 🔄 **In Progress**: Active development
- ✅ **Complete**: Implemented and tested
- ❌ **Blocked**: Dependency or issue blocking progress

---

**Last Review**: 2025-11-02  
**Next Review**: Before implementation kickoff  
**Maintained By**: QA Team + Feature Lead

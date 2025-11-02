# Implementation Plan: Advanced Visualization & Analytics

**Branch**: `006-advanced-visualization-analytics` | **Date**: 2025-11-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-advanced-visualization-analytics/spec.md`

## Summary

Advanced Visualization & Analytics transforms AIWebFeeds into a research-grade data exploration platform by adding interactive visualizations, 3D topic clustering, predictive forecasting, custom dashboards, and a data export API. Primary technical approach: client-side WebGL rendering for 3D graphs, direct SQLite database queries with caching layer for analytics data, device-based persistence (no user accounts), and time-series forecasting models for predictive insights. Key differentiator: 3D topic network visualization unique among feed readers.

## Technical Context

**Language/Version**: Python 3.13+ (backend API), TypeScript 5.9+ (web visualization frontend)
**Primary Dependencies**: 
- Backend: FastAPI 0.115+, SQLAlchemy 2.0+, Pandas 2.2+, Prophet/statsmodels (forecasting)
- Frontend: Next.js 15, React 19, Three.js 0.160+ (3D), Chart.js 4.4+ (2D charts - chosen over D3.js for React integration simplicity), React Grid Layout 1.4+
**Storage**: SQLite (development), PostgreSQL (production option) with 5-minute cache layer (Redis or in-memory)
**Testing**: pytest (backend ≥90% coverage), Vitest + React Testing Library (frontend), Playwright (E2E)
**Target Platform**: Modern web browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+) with WebGL 2.0 support
**Project Type**: Hybrid - Python backend API + Next.js frontend (extends existing apps/web)
**Performance Goals**: 
- Chart rendering: <3s for 10k data points
- 3D visualization: 60fps for 200 nodes (automatic 2D fallback <30fps)
- API response: <5s for synchronous exports (<10k records)
- Dashboard load: <3s for 6-widget dashboard
**Constraints**: 
- No user accounts: device-based persistence using localStorage + SQLite
- Direct database queries allowed (with caching) per clarifications
- WebGL required for 3D (fallback to 2D for unsupported browsers)
- Publication-quality export (300 DPI PNG, vector SVG)
**Scale/Scope**: 
- Support 100-500 topics in 3D graph
- Handle 1M+ historical data points for forecasting
- 20 widgets max per dashboard
- 100 API requests/hour per key

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Based on AIWebFeeds core principles from AGENTS.md:

### ✅ Documentation-First Development
- **Status**: PASS
- **Rationale**: All user-facing documentation will be created in `apps/web/content/docs/visualization/` as `.mdx` files with frontmatter (title, description) and added to `apps/web/content/docs/meta.json` for navigation. No standalone `.md` files will be created in packages/, apps/cli/, or data/ directories. Feature-specific planning docs (research.md, data-model.md, quickstart.md) are explicitly allowed in `specs/006-advanced-visualization-analytics/` per Spec-Driven Development workflow. LLM-optimized docs auto-generated at `/llms-full.txt`.
- **Evidence**: Task T108 targets `apps/web/content/docs/visualization/*.mdx` with requirement to update navigation.

### ✅ Component Isolation
- **Status**: PASS
- **Rationale**: Visualization features isolated in dedicated modules with clear separation:
  - Backend: `packages/ai_web_feeds/src/ai_web_feeds/visualization/` (api.py, services/, models.py)
  - Frontend: `apps/web/app/analytics/visualizations/` (pages, components)
  - Tests: `tests/packages/ai_web_feeds/visualization/` (backend), `apps/web/__tests__/visualizations/` (frontend)
  - Each component has clean interfaces (FastAPI routes, React props, SQLAlchemy models)
- **Evidence**: Task T004-T005 create isolated module structures, no cross-contamination.

### ✅ Quality Standards
- **Status**: PASS
- **Rationale**: 
  - **Type Safety**: Python with mypy strict mode, TypeScript 5.9 strict mode, JSON Schema for data validation
  - **Testing**: ≥90% coverage required (pytest for backend, Vitest for frontend, Playwright for E2E)
  - **Code Quality**: Ruff (Python), ESLint 9 (TypeScript), conventional commits enforced
  - **Coverage Verification**: Task T116 (to be added) will verify 90% threshold before production
- **Evidence**: Plan specifies "pytest ≥90% coverage", tasks include T113 performance testing, constitution mandates quality gates.

### ⚠️ No User Accounts Architecture
- **Status**: ACKNOWLEDGED
- **Rationale**: Device-based persistence using localStorage + SQLite aligns with current project architecture (no auth system exists in phases 001-005). This is a project-level architectural decision, not a constitution violation.

### Complexity Justification
No constitution violations requiring justification. All choices align with existing project standards.

## Project Structure

### Documentation (this feature)

```text
specs/006-advanced-visualization-analytics/
├── plan.md              # This file
├── research.md          # Phase 0 output (technology choices, patterns)
├── data-model.md        # Phase 1 output (entities, schemas)
├── quickstart.md        # Phase 1 output (getting started guide)
├── contracts/           # Phase 1 output (API specifications)
│   ├── visualization-api.yaml    # OpenAPI spec for viz endpoints
│   ├── export-api.yaml           # OpenAPI spec for export endpoints
│   └── forecasting-api.yaml      # OpenAPI spec for forecast endpoints
├── checklists/          # Quality validation
│   └── requirements.md
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Backend: Visualization API & Analytics
packages/ai_web_feeds/
└── src/ai_web_feeds/
    ├── visualization/           # NEW: Visualization module
    │   ├── __init__.py
    │   ├── models.py           # SQLAlchemy models (Visualization, Dashboard, Forecast, etc.)
    │   ├── schemas.py          # Pydantic schemas for API
    │   ├── service.py          # Business logic for visualization CRUD
    │   ├── cache.py            # 5-minute cache layer for analytics queries
    │   ├── forecasting.py      # Time-series forecasting engine
    │   └── export.py           # Data export service (CSV, JSON, Parquet)
    ├── api/
    │   └── v1/
    │       ├── visualizations.py   # NEW: Visualization endpoints
    │       ├── dashboards.py       # NEW: Dashboard CRUD endpoints
    │       ├── forecasting.py      # NEW: Forecast endpoints
    │       └── export.py           # NEW: Export API endpoints
    └── storage.py              # EXTEND: Add new tables for viz entities

# Frontend: Visualization UI
apps/web/
├── app/
│   └── analytics/
│       └── visualizations/     # NEW: Visualization pages
│           ├── page.tsx        # Main visualization dashboard
│           ├── 3d-explorer/    # 3D topic clustering
│           │   └── page.tsx
│           ├── dashboard-builder/  # Custom dashboards
│           │   └── page.tsx
│           └── forecasting/    # Predictive analytics
│               └── page.tsx
├── components/
│   └── visualizations/         # NEW: Reusable viz components
│       ├── ChartRenderer.tsx   # 2D charts (Chart.js/D3)
│       ├── TopicGraph3D.tsx    # 3D WebGL visualization (Three.js)
│       ├── DashboardGrid.tsx   # React Grid Layout wrapper
│       ├── ForecastChart.tsx   # Time-series with predictions
│       └── ExportButton.tsx    # Export to PNG/SVG/HTML
└── lib/
    └── visualization/          # NEW: Visualization utilities
        ├── api-client.ts       # API client for viz endpoints
        ├── chart-utils.ts      # Chart configuration helpers
        ├── webgl-utils.ts      # WebGL setup & performance monitoring
        └── export-utils.ts     # Chart export logic

# Tests
tests/
├── packages/
│   └── ai_web_feeds/
│       ├── test_visualization/     # NEW: Backend tests
│       │   ├── test_models.py
│       │   ├── test_service.py
│       │   ├── test_cache.py
│       │   ├── test_forecasting.py
│       │   └── test_export.py
│       └── test_api/
│           └── test_v1/
│               ├── test_visualizations.py  # NEW
│               ├── test_dashboards.py      # NEW
│               ├── test_forecasting.py     # NEW
│               └── test_export.py          # NEW
└── apps/
    └── web/
        └── components/
            └── visualizations/     # NEW: Frontend component tests
                ├── ChartRenderer.test.tsx
                ├── TopicGraph3D.test.tsx
                └── DashboardGrid.test.tsx

# Database Migrations
packages/alembic/versions/
└── 006_add_visualization_tables.py  # NEW: Migration for Visualization, Dashboard, etc.
```

**Structure Decision**: Hybrid web application structure chosen. Backend visualization logic added to existing `packages/ai_web_feeds/` Python package with new `/visualization` module. Frontend components added to existing `apps/web/` Next.js app under new `/analytics/visualizations` route. This extends the existing Phase 002 analytics foundation without creating a separate project.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations requiring justification. All architectural choices align with existing AIWebFeeds patterns and core principles.

# Quickstart Guide: Advanced Visualization & Analytics

Get started with interactive visualizations, custom dashboards, and time-series
forecasting in 15 minutes.

______________________________________________________________________

## Prerequisites

- **Python 3.13+** with `uv` package manager
- **Node.js 20+** with `pnpm`
- **Existing AIWebFeeds installation** (from Phase 001-002)
- **Phase 002 analytics data** (topic metrics, feed health, validation logs)

______________________________________________________________________

## 1. Setup (5 minutes)

### Install Dependencies

```bash
# Backend dependencies
cd packages/ai_web_feeds
uv sync
uv pip install prophet redis pandas

# Frontend dependencies
cd ../../apps/web
pnpm install three @react-three/fiber @react-three/drei
pnpm install chart.js react-chartjs-2 react-grid-layout
```

### Run Database Migrations

```bash
# Apply Alembic migration from data-model.md
cd packages/ai_web_feeds
uv run alembic upgrade head
```

### Start Services

```bash
# Terminal 1: Backend API (FastAPI)
cd packages/ai_web_feeds
uv run uvicorn ai_web_feeds.visualization.api:app --reload --port 8000

# Terminal 2: Frontend (Next.js)
cd apps/web
pnpm dev --port 3000

# Terminal 3: Redis (optional, for production caching)
redis-server
```

______________________________________________________________________

## 2. Your First Visualization (3 minutes)

### Create a Line Chart via UI

1. Open browser: `http://localhost:3000/analytics/visualizations`
1. Click **"Create Visualization"**
1. Configure:
   - **Chart Type**: Line Chart
   - **Data Source**: `topic_metrics` (from Phase 002)
   - **Filters**: `{"topic": "AI Research", "date_range": "7d"}`
   - **Customization**: `{"colors": ["#3b82f6"], "title": "AI Research - Weekly Trend"}`
1. Click **Save** (auto-generates device UUID in localStorage)
1. See preview with real data from Phase 002 analytics

### Export as PNG (300 DPI)

1. Click **Export** button
1. Select **PNG (High-Res)**
1. Download: `ai-research-trend.png` (publication quality)

______________________________________________________________________

## 3. Create a Custom Dashboard (5 minutes)

### Use Dashboard Builder

1. Navigate: `http://localhost:3000/analytics/dashboards`
1. Click **"New Dashboard"** → Select **"Curator Dashboard"** template
1. Drag 4 widgets onto grid:
   - **Widget 1**: Topic Cloud (top-left, 6x4 grid)
   - **Widget 2**: Feed Health Metric Card (top-right, 3x2 grid)
   - **Widget 3**: Validation Log Chart (bottom-left, 6x4 grid)
   - **Widget 4**: Latest Entries Feed List (bottom-right, 3x6 grid)
1. Click **Save Layout** (persists in SQLite with device UUID)

### Configure Widget Refresh

1. Click widget settings (⚙️ icon)
1. Set **Refresh Interval**: 300 seconds (5 minutes)
1. Enable **Auto-Refresh** toggle
1. Widgets now update every 5 minutes with live data

______________________________________________________________________

## 4. Generate a Time-Series Forecast (2 minutes)

### Create Forecast via API

```bash
# Generate 30-day forecast for "AI Research" topic
curl -X POST http://localhost:8000/api/v1/forecasts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "device_id": "YOUR_DEVICE_UUID",
    "topic_id": 1,
    "model_type": "prophet",
    "horizon_days": 30,
    "include_confidence_intervals": true
  }'

# Response (202 Accepted for async processing):
{
  "job_id": "a3f2e1d4-...",
  "forecast_id": 1,
  "status": "processing",
  "estimated_completion_seconds": 8
}
```

### View Forecast in UI

1. Navigate: `http://localhost:3000/analytics/forecasts`
1. See forecast card: **"AI Research - 30 Days"**
1. Accuracy badge: **MAPE: 12.3%** ✅ (green, no retraining needed)
1. Confidence interval shading shows prediction uncertainty

______________________________________________________________________

## 5. Export Data Programmatically

### Generate API Key

```bash
# Create API key via CLI
uv run aiwebfeeds api create-key \
  --name "Data Science Export" \
  --device-id YOUR_DEVICE_UUID

# Returns: awf_sk_abc123xyz... (save securely!)
```

### Export Dashboard as CSV

```python
import requests

response = requests.post(
    "http://localhost:8000/api/v1/export",
    headers={"X-API-Key": "awf_sk_abc123xyz..."},
    json={
        "device_id": "YOUR_DEVICE_UUID",
        "entity_type": "dashboard",
        "entity_id": 1,
        "format": "csv",
        "options": {"include_metadata": True, "compression": "gzip"},
    },
)

# Async export (large datasets)
if response.status_code == 202:
    job = response.json()
    print(f"Export job: {job['id']}")
    # Poll: GET /api/v1/export/jobs/{job_id}

# Sync export (small datasets)
elif response.status_code == 200:
    with open("dashboard_export.csv", "w") as f:
        f.write(response.json()["data"])
```

______________________________________________________________________

## 6. Performance Testing

### Test 3D Visualization Fallback

1. Open Chrome DevTools → **Performance** tab
1. Enable **CPU throttling (6x slowdown)**
1. Navigate to 3D Topic Graph: `http://localhost:3000/analytics/visualizations/3d-graph`
1. **Expected**: After 3 seconds at \<30fps → auto-switch to 2D network diagram
1. **Verify**: Console logs `"FPS below threshold, switching to 2D"`

______________________________________________________________________

## Common Issues

### ❌ `ModuleNotFoundError: No module named 'prophet'`

**Fix**: Run `uv pip install prophet` (requires compilation, may take 2-3 minutes)

### ❌ Dashboard widgets show "Loading..." forever

**Fix**: Check Phase 002 data exists:

```bash
uv run python -c "from ai_web_feeds.storage import get_db; print(get_db().execute('SELECT COUNT(*) FROM topic_metrics').fetchone())"
```

### ❌ API returns `401 Unauthorized`

**Fix**: Generate device UUID via web UI first (automatic on first visit), then pass in
API calls

______________________________________________________________________

## Next Steps

- **Explore Templates**: Try "Research Overview" and "Topic Monitor" dashboard templates
- **Customize Themes**: Edit Chart.js color palettes in `apps/web/lib/chart-themes.ts`
- **API Rate Limits**: See `data-model.md` for rate limiting configuration (1000
  req/hour default)
- **Advanced Forecasting**: Read `research.md` for Prophet seasonality tuning

**Full Documentation**: See `/specs/006-advanced-visualization-analytics/` directory
for:

- `spec.md`: Functional requirements and edge cases
- `data-model.md`: Database schema and SQLAlchemy models
- `contracts/*.yaml`: OpenAPI specifications for all endpoints

**Questions?** Open GitHub issue with `[viz]` prefix.

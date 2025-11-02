# Quickstart: Phase 2 - Data Discovery & Analytics

**Feature Branch**: `002-data-discovery-analytics`  
**Date**: 2025-10-22  
**Status**: Ready for Implementation

---

## Overview

This quickstart guide covers setting up the development environment, running the Phase 2 implementation, and verifying analytics, search, and recommendation features.

---

## Prerequisites

### Software Requirements

- **Python**: 3.13+ ([Install](https://www.python.org/downloads/))
- **Node.js**: 18+ ([Install](https://nodejs.org/))
- **uv**: Latest version ([Install](https://github.com/astral-sh/uv#installation))
- **pnpm**: Latest version ([Install](https://pnpm.io/installation))
- **Git**: Any recent version

### Optional

- **Hugging Face API Token**: Free tier account ([Sign up](https://huggingface.co/join))
  - Enables optional cloud-based embedding generation
  - 1000 requests/day on free tier
  - Not required (local embeddings work by default)

---

## Setup Instructions

### 1. Clone & Switch to Feature Branch

```bash
# If not already cloned
git clone https://github.com/wyattowalsh/ai-web-feeds.git
cd ai-web-feeds

# Switch to Phase 2 feature branch
git checkout 002-data-discovery-analytics

# Pull latest changes
git pull origin 002-data-discovery-analytics
```

### 2. Python Environment Setup

```bash
# Install dependencies with uv
cd /path/to/ai-web-feeds
uv sync

# Verify installation
uv run python --version  # Should be 3.13+
uv run aiwebfeeds --version
```

**Installed Dependencies** (from `pyproject.toml`):
- `sqlmodel` - Type-safe ORM
- `sentence-transformers` - Local embeddings
- `scikit-learn` - Collaborative filtering (Phase 2)
- `httpx` - Async HTTP client
- `feedparser` - Feed parsing
- `tenacity` - Retry logic
- `numpy` - Vector math
- `pydantic-settings` - Configuration
- `tqdm` - Progress bars
- `loguru` - Structured logging

### 3. TypeScript/Web Setup

```bash
# Install web dependencies
cd apps/web
pnpm install

# Verify installation
pnpm next --version  # Should be 15+
```

**Installed Dependencies** (from `package.json`):
- `next@15` - React framework
- `react@19` - UI library
- `tailwindcss@4` - CSS framework
- `chart.js` - Charting library
- `fumadocs` - Documentation framework

### 4. Environment Configuration

Create `.env` file in project root:

```bash
# Copy example
cp env.example .env

# Edit with your preferences
nano .env
```

**Required Configuration**:
```bash
# Database
AIWF_DATABASE_URL=sqlite:///data/aiwebfeeds.db

# Logging
AIWF_LOGGING__LEVEL=INFO
AIWF_LOGGING__CONSOLE=True

# Fetching
AIWF_FETCH_TIMEOUT=30
AIWF_MAX_RETRIES=3

# Data paths
AIWF_DATA_DIR=data
```

**Optional Configuration** (Embedding Provider):
```bash
# Embedding settings (local is default)
AIWF_EMBEDDING__PROVIDER=local  # "local" or "huggingface"
AIWF_EMBEDDING__LOCAL_MODEL=sentence-transformers/all-MiniLM-L6-v2

# If using Hugging Face API (optional)
AIWF_EMBEDDING__PROVIDER=huggingface
AIWF_EMBEDDING__HF_API_TOKEN=hf_your_token_here
AIWF_EMBEDDING__HF_MODEL=sentence-transformers/all-MiniLM-L6-v2
```

**Optional Configuration** (Analytics Caching):
```bash
# Analytics settings
AIWF_ANALYTICS__STATIC_CACHE_TTL=3600   # 1 hour
AIWF_ANALYTICS__DYNAMIC_CACHE_TTL=300   # 5 minutes
AIWF_ANALYTICS__MAX_CONCURRENT_QUERIES=10
```

### 5. Database Setup

```bash
# Initialize database with schema
uv run aiwebfeeds db init

# Load feed data from YAML
uv run aiwebfeeds load data/feeds.yaml

# Verify data loaded
uv run aiwebfeeds db stats
```

**Expected Output**:
```
✓ Database initialized: data/aiwebfeeds.db
✓ Loaded 1000 feeds from data/feeds.yaml
✓ Tables: sources(1000), validations(0), embeddings(0)
```

---

## Development Workflow

### Phase 2 Implementation Steps

#### Step 1: Analytics Module

```bash
# Implement analytics calculation module
# File: packages/ai_web_feeds/src/ai_web_feeds/analytics.py

# Run unit tests
uv run pytest tests/tests/packages/ai_web_feeds/test_analytics.py -v

# Test CLI command
uv run aiwebfeeds analytics summary --date-range 30d

# Expected: JSON output with total_feeds, success_rate, avg_response_time
```

#### Step 2: Search Module

```bash
# Implement full-text search
# File: packages/ai_web_feeds/src/ai_web_feeds/search.py

# Build FTS5 index
uv run aiwebfeeds search index

# Test full-text search
uv run aiwebfeeds search query "transformer models" --type full_text

# Test autocomplete
uv run aiwebfeeds search autocomplete "trans"

# Run unit tests
uv run pytest tests/tests/packages/ai_web_feeds/test_search.py -v
```

#### Step 3: Embedding Generation

```bash
# Implement embedding module
# File: packages/ai_web_feeds/src/ai_web_feeds/embeddings.py

# Generate embeddings for all feeds (local mode)
uv run aiwebfeeds embeddings generate --provider local --batch-size 32

# Expected: Progress bar, ~50-100ms per feed on CPU
# Output: Generated 1000 embeddings in 60s

# Verify embeddings stored
uv run python -c "from ai_web_feeds.storage import DatabaseManager; db = DatabaseManager(); print(db.get_embedding_count())"
```

**Optional: Test Hugging Face API**
```bash
# Set HF API token in .env
AIWF_EMBEDDING__PROVIDER=huggingface
AIWF_EMBEDDING__HF_API_TOKEN=hf_your_token_here

# Generate embeddings via HF API
uv run aiwebfeeds embeddings generate --provider huggingface --batch-size 10

# Note: Free tier limit is 1000 requests/day
```

#### Step 4: Semantic Search

```bash
# Test semantic search with embeddings
uv run aiwebfeeds search query "attention mechanisms" --type semantic --threshold 0.7

# Expected: Results ranked by cosine similarity
# Output: 15 results with similarity scores >= 0.7
```

#### Step 5: Recommendation Module

```bash
# Implement recommendation module
# File: packages/ai_web_feeds/src/ai_web_feeds/recommendations.py

# Test cold start recommendations
uv run aiwebfeeds recommend cold-start --topics LLM,NLP,Computer-Vision --limit 20

# Test content-based recommendations
uv run aiwebfeeds recommend content-based --user-id test-user --limit 20

# Run unit tests
uv run pytest tests/tests/packages/ai_web_feeds/test_recommendations.py -v
```

#### Step 6: Web UI Development

```bash
# Start Next.js development server
cd apps/web
pnpm dev

# Open browser: http://localhost:3000
```

**Test Routes**:
- `/analytics` - Analytics dashboard
- `/search` - Search interface
- `/recommendations` - Recommendations page

**API Routes** (test with curl):
```bash
# Analytics summary
curl "http://localhost:3000/api/analytics/summary?date_range=30d"

# Search feeds
curl "http://localhost:3000/api/search?q=transformer&search_type=full_text"

# Get recommendations
curl "http://localhost:3000/api/recommendations?user_id=test-user&limit=10"
```

---

## Verification Checklist

### ✅ Phase 2 Acceptance Criteria

#### Analytics Dashboard

- [ ] Dashboard loads within 2 seconds on 4G connection
- [ ] Displays key metrics: total feeds, success rate, avg response time, health distribution
- [ ] Time range filters work (7d, 30d, 90d, custom)
- [ ] Topic filter dropdown populated from topics.yaml
- [ ] Trending topics chart shows top 10 topics ranked by validation frequency
- [ ] Publication velocity chart shows daily/weekly/monthly posting frequency
- [ ] Feed health distribution pie chart shows healthy/moderate/unhealthy counts
- [ ] CSV export downloads correctly formatted file
- [ ] "Refresh Now" button updates data on-demand
- [ ] Data freshness indicator shows last update timestamp

#### Search & Discovery

- [ ] Search autocomplete responds within 200ms
- [ ] Full-text search returns results within 500ms for 1000+ feeds
- [ ] Search results highlight matching keywords in bold
- [ ] Faceted filters work (source type, topics, verified, active)
- [ ] Filter count badges show correct totals
- [ ] Semantic search toggle enables vector similarity search
- [ ] Semantic search completes within 3 seconds
- [ ] "Save Search" button stores query+filters correctly
- [ ] Saved searches appear in sidebar with one-click replay
- [ ] Zero results page shows helpful suggestions and "Add Feed" link

#### AI Recommendations

- [ ] Cold start onboarding quiz selects 3-5 topics
- [ ] Recommendations generate within 1 second
- [ ] 10-20 recommendations displayed per page
- [ ] Recommendation cards show "Why?" explanation on hover/click
- [ ] "Like" button boosts similar topic recommendations
- [ ] "Dismiss" button reduces similar feed scores
- [ ] "Not interested in topic" blocks topic from future recommendations
- [ ] Diversity constraints enforced (max 3 feeds per topic, min 2 topics)
- [ ] Recommendations update after user feedback (refresh page)

### 🧪 Test Coverage

```bash
# Run full test suite
uv run pytest tests/ --cov --cov-report=html

# Expected: ≥90% coverage for all modules
```

**Test Breakdown**:
- `test_analytics.py` - Analytics calculation, caching, trending topics
- `test_search.py` - Full-text search, FTS5 index, autocomplete
- `test_embeddings.py` - Local embeddings, HF API embeddings, hybrid fallback
- `test_recommendations.py` - Content-based filtering, cold start, diversity

### 📊 Performance Benchmarks

```bash
# Run performance benchmarks
uv run python scripts/benchmark_phase1.py
```

**Expected Performance**:
| Operation | Target | Actual |
|-----------|--------|--------|
| Analytics dashboard load | <2s | ___ |
| Search autocomplete | <200ms | ___ |
| Full-text search | <500ms | ___ |
| Semantic search | <3s | ___ |
| Recommendation generation | <1s | ___ |

---

## Common Issues & Troubleshooting

### Issue: Database locked error

**Symptom**: `sqlite3.OperationalError: database is locked`

**Solution**:
```bash
# Enable WAL mode (should be automatic, but verify)
uv run python -c "from ai_web_feeds.storage import DatabaseManager; db = DatabaseManager(); db.enable_wal_mode()"
```

### Issue: Embedding generation is slow

**Symptom**: >200ms per feed for local embeddings

**Solution**:
```bash
# Use HF API for faster embedding generation (optional)
AIWF_EMBEDDING__PROVIDER=huggingface

# Or: Increase batch size for local model
uv run aiwebfeeds embeddings generate --batch-size 64
```

### Issue: Semantic search returns no results

**Symptom**: Semantic search always returns 0 results

**Solution**:
```bash
# Verify embeddings are generated
uv run python -c "from ai_web_feeds.storage import DatabaseManager; db = DatabaseManager(); print(f'Embeddings: {db.get_embedding_count()}')"

# Regenerate if count is 0
uv run aiwebfeeds embeddings generate --provider local
```

### Issue: FTS5 search not finding expected results

**Symptom**: Full-text search missing obvious matches

**Solution**:
```bash
# Rebuild FTS5 index
uv run aiwebfeeds search rebuild-index

# Verify index populated
uv run python -c "import sqlite3; conn = sqlite3.connect('data/aiwebfeeds.db'); print(conn.execute('SELECT COUNT(*) FROM feed_search_index').fetchone())"
```

### Issue: Web UI not loading analytics data

**Symptom**: Analytics dashboard shows "Loading..." indefinitely

**Solution**:
```bash
# Check API route logs
cd apps/web
pnpm dev

# Test API directly
curl http://localhost:3000/api/analytics/summary

# Verify database path in .env matches actual database location
```

---

## Next Steps

Once Phase 2 implementation is complete and all acceptance criteria are met:

1. **Run `/speckit.analyze`** to perform cross-artifact consistency check
2. **Fix any identified issues** from the analysis report
3. **Merge to main** after code review and CI/CD pipeline passes
4. **Deploy to production** (optional, staging first recommended)
5. **Monitor metrics** for first 30 days:
   - Analytics dashboard usage (target: 80% weekly curator engagement)
   - Search CTR (target: ≥40%)
   - Recommendation CTR (target: ≥15%)
   - Zero-result queries (target: <30%)

6. **Iterate based on feedback** and prepare for Phase 3 (User Accounts & Collaborative Filtering)

---

## Additional Resources

- **Full Specification**: [`spec.md`](./spec.md)
- **Implementation Plan**: [`plan.md`](./plan.md)
- **Technology Research**: [`research.md`](./research.md)
- **Data Model**: [`data-model.md`](./data-model.md)
- **API Contracts**: [`contracts/openapi.yaml`](./contracts/openapi.yaml)
- **Project Constitution**: [`/.specify/memory/constitution.md`](/.specify/memory/constitution.md)
- **Core Package Docs**: [`packages/ai_web_feeds/AGENTS.md`](../../packages/ai_web_feeds/AGENTS.md)
- **Web App Docs**: [`apps/web/AGENTS.md`](../../apps/web/AGENTS.md)

---

**Need Help?**
- Open an issue: [GitHub Issues](https://github.com/wyattowalsh/ai-web-feeds/issues)
- Read the contributing guide: [`CONTRIBUTING.md`](/CONTRIBUTING.md)
- Check the FAQ: [aiwebfeeds.com/docs/faq](https://aiwebfeeds.com/docs/faq)

---

**Version**: 0.2.0 (Phase 2) | **Last Updated**: 2025-10-22


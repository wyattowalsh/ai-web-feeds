# Deployment Guide - Phase 1: Data Discovery & Analytics

> **For**: Production deployment of Phase 1 MVP  
> **Stack**: Python 3.13+, Next.js 15, SQLite, pnpm, uv

---

## Prerequisites

### System Requirements
- **Python**: 3.13+ (for backend)
- **Node.js**: 20+ (for web)
- **Package Managers**: `uv` (Python), `pnpm` (Node.js)
- **Database**: SQLite 3.35+ (with FTS5 support)
- **Memory**: 2GB+ RAM recommended
- **Storage**: 500MB+ for dependencies + database

### Required Tools
```bash
# Install uv (Python package manager)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install pnpm (Node.js package manager)
npm install -g pnpm

# Verify installations
uv --version
pnpm --version
```

---

## Environment Configuration

### 1. Create Environment File

```bash
cp env.example .env
```

### 2. Configure Environment Variables

```bash
# Database
AIWF_DATABASE_URL="sqlite:///data/aiwebfeeds.db"

# Logging
AIWF_LOGGING__LEVEL="INFO"
AIWF_LOGGING__CONSOLE=true
AIWF_LOGGING__FILE=true
AIWF_LOGGING__FILE_PATH="logs/aiwebfeeds.log"

# Search & Embeddings
AIWF_EMBEDDING__PROVIDER="local"  # or "huggingface"
AIWF_EMBEDDING__HF_API_TOKEN=""   # optional, for HF API
AIWF_EMBEDDING__LOCAL_MODEL="sentence-transformers/all-MiniLM-L6-v2"

# Analytics
AIWF_ANALYTICS__STATIC_CACHE_TTL=3600
AIWF_ANALYTICS__DYNAMIC_CACHE_TTL=300

# Recommendations
AIWF_RECOMMENDATION__CONTENT_WEIGHT=0.7
AIWF_RECOMMENDATION__POPULARITY_WEIGHT=0.2
AIWF_RECOMMENDATION__SERENDIPITY_WEIGHT=0.1

# Web (Next.js)
NEXT_PUBLIC_BASE_URL="https://your-domain.com"
```

---

## Backend Deployment

### 1. Install Dependencies

```bash
# Install Python dependencies
uv sync

# Verify installation
uv run python -c "import ai_web_feeds; print('✓ Backend installed')"
```

### 2. Initialize Database

```bash
# Create database and tables
uv run python -c "
from ai_web_feeds.storage import DatabaseManager
db = DatabaseManager()
print('✓ Database initialized')
"

# Initialize search tables (FTS5 + Trie)
uv run aiwebfeeds search init
```

### 3. Load Initial Data

```bash
# Load feeds from YAML
uv run aiwebfeeds load --input data/feeds.yaml

# Validate feeds
uv run aiwebfeeds validate http --concurrency 10

# Generate embeddings (optional, for semantic search)
uv run aiwebfeeds search embeddings --provider local
```

### 4. Verify Backend

```bash
# Test CLI commands
uv run aiwebfeeds analytics summary
uv run aiwebfeeds search query "machine learning" --limit 5
uv run aiwebfeeds recommend get --topics llm --limit 5
```

---

## Frontend Deployment

### 1. Install Dependencies

```bash
cd apps/web
pnpm install
```

### 2. Build for Production

```bash
# Build static site
pnpm build

# Verify build
ls -lh .next/

# Test production build locally
pnpm start
```

### 3. Deploy to Vercel (Recommended)

```bash
# Install Vercel CLI
pnpm add -g vercel

# Deploy
vercel --prod

# Configure environment variables in Vercel dashboard
```

### Alternative: Deploy to Netlify

```bash
# netlify.toml already configured
netlify deploy --prod
```

---

## Production Checklist

### Security
- [ ] Set `AIWF_LOGGING__DIAGNOSE=false` in production
- [ ] Enable HTTPS/TLS
- [ ] Set strong `AIWF_DATABASE_URL` if using PostgreSQL
- [ ] Rotate `AIWF_EMBEDDING__HF_API_TOKEN` if using HF API
- [ ] Configure CORS if needed

### Performance
- [ ] Enable SQLite WAL mode (already configured)
- [ ] Set `AIWF_ANALYTICS__STATIC_CACHE_TTL=3600` for caching
- [ ] Configure CDN for static assets
- [ ] Enable Gzip/Brotli compression
- [ ] Set up database backups

### Monitoring
- [ ] Configure log aggregation (Loguru → file)
- [ ] Set up error tracking (Sentry optional)
- [ ] Monitor API response times
- [ ] Track database size growth
- [ ] Set up uptime monitoring

### Testing
- [ ] Run test suite: `cd tests && uv run pytest`
- [ ] Run E2E tests: `cd tests && uv run pytest -m e2e`
- [ ] Run performance benchmarks: `uv run pytest -m benchmark`
- [ ] Verify all CLI commands work
- [ ] Test all web routes

---

## Scaling Considerations

### Database
- **SQLite (Current)**: Good for 1K-50K feeds, 100-1K concurrent users
- **PostgreSQL (Future)**: For >50K feeds or >1K concurrent users
- **Migration Path**: SQLModel supports both, change `DATABASE_URL`

### Caching
- **Current**: Python `functools.lru_cache` + SQLite temp tables
- **Future**: Redis for distributed caching

### Search
- **Current**: SQLite FTS5 (in-process)
- **Future**: Elasticsearch/Meilisearch for advanced search

### Embeddings
- **Current**: Local Sentence-Transformers
- **Future**: Dedicated embedding service or cloud API

---

## Maintenance

### Database Backup

```bash
# Backup SQLite database
cp data/aiwebfeeds.db data/backups/aiwebfeeds-$(date +%Y%m%d).db

# Compress backup
gzip data/backups/aiwebfeeds-$(date +%Y%m%d).db
```

### Log Rotation

Loguru handles this automatically with configuration:
```python
AIWF_LOGGING__FILE_ROTATION="10 MB"
AIWF_LOGGING__FILE_RETENTION="14 days"
AIWF_LOGGING__FILE_COMPRESSION="gz"
```

### Embedding Refresh

```bash
# Refresh embeddings for new/updated feeds
uv run aiwebfeeds search embeddings --provider local
```

### Analytics Snapshots

```bash
# Create daily snapshot
uv run aiwebfeeds analytics snapshot

# Export analytics to CSV
uv run aiwebfeeds analytics export --range 30d
```

---

## Troubleshooting

### "FTS5 not available"
**Solution**: Upgrade SQLite to 3.35+
```bash
# Check SQLite version
sqlite3 --version

# Upgrade on Ubuntu/Debian
sudo apt-get update && sudo apt-get install sqlite3
```

### "Sentence-transformers model download fails"
**Solution**: Pre-download model or use HF API
```bash
# Pre-download model
uv run python -c "
from sentence_transformers import SentenceTransformer
model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
print('✓ Model downloaded')
"
```

### "Out of memory during embedding generation"
**Solution**: Reduce batch size
```python
# In embeddings.py, change:
generate_all_feed_embeddings(feeds, batch_size=16)  # was 32
```

### "Next.js build fails"
**Solution**: Check Node.js version and clear cache
```bash
node --version  # Should be 20+
pnpm store prune
rm -rf .next node_modules
pnpm install
pnpm build
```

---

## Performance Tuning

### SQLite Optimization

```python
# Already configured in storage.py
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA cache_size=10000;
PRAGMA temp_store=MEMORY;
PRAGMA mmap_size=268435456;
```

### Web Optimization

```typescript
// Already configured in next.config.mjs
export default {
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  reactStrictMode: true,
}
```

---

## Rollback Procedure

### Backend Rollback

```bash
# Restore database backup
cp data/backups/aiwebfeeds-YYYYMMDD.db.gz data/
gunzip data/aiwebfeeds-YYYYMMDD.db.gz
mv data/aiwebfeeds-YYYYMMDD.db data/aiwebfeeds.db

# Reinstall previous version
git checkout <previous-commit>
uv sync
```

### Frontend Rollback

```bash
# Vercel: Use dashboard to rollback deployment
# Or redeploy previous commit
git checkout <previous-commit>
cd apps/web
pnpm build
vercel --prod
```

---

## Support

- **Documentation**: [aiwebfeeds.com/docs](https://aiwebfeeds.com/docs)
- **Issues**: [github.com/wyattowalsh/ai-web-feeds/issues](https://github.com/wyattowalsh/ai-web-feeds/issues)
- **Discussions**: [github.com/wyattowalsh/ai-web-feeds/discussions](https://github.com/wyattowalsh/ai-web-feeds/discussions)

---

**✅ Deployment Complete!**

Your Phase 1 MVP is now live with:
- Analytics Dashboard
- Search & Discovery
- AI-Powered Recommendations
- 100% Free & Open Source Stack


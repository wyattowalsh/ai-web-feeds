# Technology Research: Phase 1 - Data Discovery & Analytics

**Feature Branch**: `002-data-discovery-analytics`  
**Date**: 2025-10-22  
**Status**: Research Complete

---

## Overview

This document consolidates technology decisions for implementing Analytics Dashboard, Intelligent Search & Discovery, and AI-Powered Feed Recommendations. All decisions prioritize free, open-source solutions with permissive licenses.

---

## 1. Database & Storage

### Decision: SQLite 3.40+ with FTS5, JSON1, WAL mode

**Rationale**:
- **Public Domain License**: Zero licensing concerns, truly free and open-source
- **Serverless**: No daemon process, no port conflicts, single-file portability
- **FTS5 Built-in**: Full-text search with ranking, porter stemming, phrase queries
- **JSON1 Extension**: Native JSON support for analytics snapshots and flexible schemas
- **WAL Mode**: Write-Ahead Logging enables 1000+ concurrent readers without blocking
- **Performance**: Handles 100K+ FTS rows with sub-second queries, sufficient for 50K feeds
- **Zero Configuration**: Works out-of-the-box, no server setup or tuning required

**Alternatives Considered**:
- **PostgreSQL**: Requires server setup, heavier resource footprint, overkill for MVP scale (1K-10K users)
- **MySQL/MariaDB**: Similar complexity to PostgreSQL, no significant advantages for this use case
- **Elasticsearch**: External service, requires JVM, higher operational complexity, license concerns (Elastic License)

**Implementation Patterns**:
```python
# Enable performance optimizations
PRAGMA journal_mode = WAL;           # Concurrent reads
PRAGMA cache_size = -200000;         # 200MB cache
PRAGMA temp_store = MEMORY;          # Fast temp tables
PRAGMA synchronous = NORMAL;         # Balance speed/durability
PRAGMA mmap_size = 268435456;        # 256MB memory-mapped I/O
```

**Resources**:
- [SQLite FTS5 Documentation](https://www.sqlite.org/fts5.html)
- [JSON1 Extension Guide](https://www.sqlite.org/json1.html)
- [WAL Mode Performance](https://www.sqlite.org/wal.html)

---

## 2. Full-Text Search

### Decision: SQLite FTS5 with Porter Stemming

**Rationale**:
- **Built-in**: No external dependencies, no server to maintain
- **Porter Stemming**: Handles word variations (e.g., "transform" matches "transformers")
- **Ranking**: BM25-like ranking algorithm built into FTS5
- **Unicode Support**: `unicode61` tokenizer handles international characters
- **Performance**: Sub-second search for 50K+ feeds, tested in production use cases
- **Query Syntax**: Boolean operators, phrase matching, prefix search out-of-the-box

**Alternatives Considered**:
- **Meilisearch**: Excellent UX but requires separate server, adds deployment complexity
- **Typesense**: Similar to Meilisearch, requires external service
- **Elasticsearch**: Heavy infrastructure, license concerns, overkill for text-only search
- **Whoosh (Python)**: Pure Python, slower than SQLite FTS5, less mature

**Implementation Patterns**:
```sql
-- Create FTS5 virtual table
CREATE VIRTUAL TABLE feeds_fts USING fts5(
  title, description, content,
  tokenize='porter unicode61'
);

-- Search with ranking
SELECT feed_id, rank 
FROM feeds_fts 
WHERE feeds_fts MATCH 'transformer attention'
ORDER BY rank 
LIMIT 20;

-- Highlight matches
SELECT highlight(feeds_fts, 0, '<b>', '</b>') AS title_highlighted
FROM feeds_fts
WHERE feeds_fts MATCH 'BERT';
```

**Resources**:
- [FTS5 Full-Text Query Syntax](https://www.sqlite.org/fts5.html#full_text_query_syntax)
- [FTS5 Auxiliary Functions](https://www.sqlite.org/fts5.html#fts5_auxiliary_functions)

---

## 3. Semantic Search (Vector Embeddings)

### Decision: Sentence-Transformers (Local) + Optional Hugging Face Inference API

**Rationale**:
- **Default Local Mode**: Zero setup, no API tokens, no rate limits, works offline
- **Permissive License**: Apache 2.0 (Sentence-Transformers) + Model License (Apache 2.0 for all-MiniLM-L6-v2)
- **CPU-Optimized Models**: `all-MiniLM-L6-v2` runs efficiently on CPU (~50-100ms per text)
- **Small Model Size**: 80MB download, reasonable for local deployment
- **Optional HF API**: Users can offload compute to Hugging Face (free tier: 1000 req/day)
- **Hybrid Fallback**: Automatically falls back to local if HF API unavailable/rate-limited
- **Quality**: 384-dim embeddings, sufficient for semantic similarity tasks
- **Active Maintenance**: Hugging Face maintains models and inference infrastructure

**Alternatives Considered**:
- **OpenAI Embeddings**: Paid API, vendor lock-in, privacy concerns
- **Cohere Embeddings**: Similar issues to OpenAI
- **USE (Universal Sentence Encoder)**: TensorFlow dependency, heavier runtime
- **Cloud-only solutions**: Would violate open-source principles, require external dependencies

**Implementation Patterns**:
```python
from sentence_transformers import SentenceTransformer
import numpy as np
import os
import requests

# Local embedding generation (default)
model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')

def generate_embeddings_local(texts: list[str]) -> np.ndarray:
    """Generate embeddings locally on CPU"""
    embeddings = model.encode(texts, show_progress_bar=True)
    return embeddings  # Shape: (len(texts), 384)

# Optional HF API embedding generation
def generate_embeddings_hf(texts: list[str]) -> list[list[float]]:
    """Generate embeddings via Hugging Face Inference API"""
    HF_API_TOKEN = os.getenv("HF_API_TOKEN")
    HF_API_URL = "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2"
    
    headers = {"Authorization": f"Bearer {HF_API_TOKEN}"}
    response = requests.post(HF_API_URL, headers=headers, json={"inputs": texts})
    embeddings = response.json()
    return embeddings

# Hybrid approach with automatic fallback
def generate_embeddings_hybrid(texts: list[str], use_api: bool = False) -> np.ndarray:
    """Use HF API if available, fallback to local"""
    if use_api and os.getenv("HF_API_TOKEN"):
        try:
            return np.array(generate_embeddings_hf(texts))
        except (requests.RequestException, KeyError) as e:
            logger.warning(f"HF API failed, falling back to local: {e}")
    
    return generate_embeddings_local(texts)
```

**Resources**:
- [Sentence-Transformers Documentation](https://www.sbert.net/)
- [Hugging Face Inference API](https://huggingface.co/docs/api-inference/index)
- [all-MiniLM-L6-v2 Model Card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)

---

## 4. Vector Storage & Similarity Search

### Decision: SQLite BLOB + NumPy (MVP) with upgrade path to sqlite-vec

**Rationale**:
- **Zero Dependencies**: NumPy already required for ML tasks, no new dependencies
- **Simple Implementation**: Store embeddings as BLOB, compute similarity in Python
- **Good Enough Performance**: <2s for 10K embeddings (brute-force cosine similarity)
- **Upgrade Path**: Can add `sqlite-vec` extension later if performance becomes bottleneck
- **No Lock-in**: Standard SQLite BLOB storage, easy to migrate

**Alternatives Considered**:
- **sqlite-vec Extension** (MIT): Faster native vector search, but adds external dependency. Can be added later without data migration.
- **FAISS (Facebook AI Similarity Search)**: Overkill for <10K vectors, requires C++ dependencies
- **Pinecone/Weaviate**: Cloud vector databases, violates open-source principles
- **Qdrant**: Self-hosted option but requires separate service

**Implementation Patterns**:
```python
# Store embeddings in SQLite
CREATE TABLE feed_embeddings (
  feed_id TEXT PRIMARY KEY,
  embedding BLOB NOT NULL,  -- 384 float32 values (1536 bytes)
  model_version TEXT NOT NULL,
  last_updated TEXT NOT NULL
);

# Python cosine similarity (brute-force for MVP)
import numpy as np

def search_similar_feeds(query_text: str, threshold: float = 0.7, limit: int = 10):
    query_vec = model.encode([query_text])[0]
    results = []
    
    for feed_id, embedding_blob in db.execute("SELECT feed_id, embedding FROM feed_embeddings"):
        feed_vec = np.frombuffer(embedding_blob, dtype=np.float32)
        similarity = np.dot(query_vec, feed_vec) / (
            np.linalg.norm(query_vec) * np.linalg.norm(feed_vec)
        )
        if similarity >= threshold:
            results.append((feed_id, similarity))
    
    return sorted(results, key=lambda x: x[1], reverse=True)[:limit]
```

**Future Optimization (sqlite-vec)**:
```sql
-- Install: pip install sqlite-vec
SELECT feed_id, vec_distance_cosine(embedding, ?) as similarity
FROM feed_embeddings
WHERE similarity >= 0.7
ORDER BY similarity DESC
LIMIT 10;
```

**Resources**:
- [sqlite-vec Extension (MIT)](https://github.com/asg017/sqlite-vec)
- [NumPy Cosine Similarity](https://numpy.org/doc/stable/reference/generated/numpy.dot.html)

---

## 5. Caching Strategy

### Decision: Python functools.lru_cache + SQLite TEMP tables

**Rationale**:
- **No External Service**: Python stdlib `lru_cache`, no Redis/Memcached required
- **Sufficient for MVP**: Autocomplete, trending topics, popular searches cache well
- **SQLite TEMP Tables**: Precomputed analytics, materialized views, collaborative matrices
- **Low Latency**: In-memory Python cache (~1-5ms lookup), SQLite TEMP (~10-50ms)
- **Simple Operations**: No network latency, no serialization overhead
- **Automatic Eviction**: LRU policy handles memory management

**Alternatives Considered**:
- **Redis**: External server, adds deployment complexity, overkill for MVP caching needs
- **Memcached**: Similar to Redis, requires separate daemon
- **Diskcache**: Python library for persistent caching, slower than in-memory

**Implementation Patterns**:
```python
from functools import lru_cache
import sqlite3

# Application-level cache (Python functools)
@lru_cache(maxsize=1000)
def get_autocomplete_suggestions(prefix: str, limit: int = 5) -> list[str]:
    """Cache autocomplete results for 5 minutes"""
    # Query SQLite FTS5 for matches
    ...

# Clear cache manually when data changes
get_autocomplete_suggestions.cache_clear()

# Database-level cache (SQLite TEMP tables)
CREATE TEMP TABLE analytics_cache AS
SELECT 
  DATE(validated_at) as snapshot_date,
  COUNT(*) as total_validations,
  AVG(response_time) as avg_response_time,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate
FROM validation_results
WHERE validated_at >= DATE('now', '-30 days')
GROUP BY snapshot_date;

-- Query cached data (fast)
SELECT * FROM analytics_cache WHERE snapshot_date = DATE('now');

# Hybrid caching with TTL
from datetime import datetime, timedelta

class CacheWithTTL:
    def __init__(self, ttl_seconds: int):
        self.cache = {}
        self.ttl = timedelta(seconds=ttl_seconds)
    
    def get(self, key: str):
        if key in self.cache:
            value, timestamp = self.cache[key]
            if datetime.now() - timestamp < self.ttl:
                return value
        return None
    
    def set(self, key: str, value):
        self.cache[key] = (value, datetime.now())

# Usage
static_cache = CacheWithTTL(ttl_seconds=3600)  # 1 hour for static metrics
dynamic_cache = CacheWithTTL(ttl_seconds=300)  # 5 minutes for dynamic metrics
```

**Cache Layering Strategy**:
1. **Application Cache** (functools.lru_cache): 5-30 min TTL for autocomplete, trending topics
2. **Database Cache** (SQLite TEMP tables): Daily/nightly refresh for analytics aggregations
3. **Browser Cache** (localStorage): Search history, saved searches, recommendation feedback

**Resources**:
- [functools.lru_cache Documentation](https://docs.python.org/3/library/functools.html#functools.lru_cache)
- [SQLite TEMP Tables](https://www.sqlite.org/tempfiles.html)

---

## 6. Recommendation Algorithm

### Decision: Content-Based Filtering (Phase 1) with Collaborative Filtering Prep (Phase 2)

**Rationale**:
- **No User Accounts**: Phase 1 has no authentication, so no user-user interaction data
- **Content-Based Works**: Topic overlap + embedding similarity provide value without accounts
- **Popularity Boost**: Verified feeds + most followed feeds add quality signals
- **Serendipity**: 10% random high-quality feeds prevent filter bubbles
- **localStorage Tracking**: Collect anonymous likes/dismisses for future collaborative filtering
- **Phase 2 Ready**: When user accounts added, can enable collaborative filtering immediately

**Alternatives Considered**:
- **Implement Collaborative Filtering Now**: Requires user accounts system (deferred to Phase 2)
- **Pure Popularity**: Would not personalize, defeats purpose of "AI-powered"
- **External Recommendation API**: Vendor lock-in, privacy concerns, costs

**Algorithm Breakdown** (Phase 1):
- **70% Content-Based**: Topic overlap + embedding similarity (cosine ≥0.7)
- **20% Popularity-Based**: Most followed/verified feeds
- **10% Serendipity**: Random high-quality feeds (health score ≥0.8)

**Implementation Patterns**:
```python
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

def generate_recommendations(
    user_interests: list[str],  # Topics from onboarding quiz
    followed_feeds: list[str],  # Currently followed feed IDs
    limit: int = 20
) -> list[dict]:
    """Generate content-based recommendations"""
    
    # 1. Get candidate feeds (not already followed)
    candidates = db.execute("""
        SELECT feed_id, topics, embedding, popularity_score, health_score
        FROM feed_sources
        WHERE feed_id NOT IN (?)
        AND is_active = TRUE
    """, (followed_feeds,)).fetchall()
    
    # 2. Score each candidate
    scores = []
    for feed in candidates:
        # Content-based score (topic overlap + embedding similarity)
        topic_overlap = len(set(feed['topics']) & set(user_interests)) / len(user_interests)
        
        if followed_feeds:
            followed_embeddings = [get_embedding(fid) for fid in followed_feeds]
            avg_followed_embedding = np.mean(followed_embeddings, axis=0)
            embedding_similarity = cosine_similarity(
                [feed['embedding']], [avg_followed_embedding]
            )[0][0]
        else:
            embedding_similarity = 0.0
        
        content_score = 0.6 * topic_overlap + 0.4 * embedding_similarity
        
        # Popularity score
        popularity_score = feed['popularity_score']
        
        # Combined score (70% content, 20% popularity, 10% random)
        final_score = (
            0.7 * content_score +
            0.2 * popularity_score +
            0.1 * np.random.random()
        )
        
        scores.append((feed['feed_id'], final_score))
    
    # 3. Return top K
    scores.sort(key=lambda x: x[1], reverse=True)
    return scores[:limit]
```

**Phase 2 Preparation** (Collaborative Filtering):
```python
# Collect anonymous interaction data in localStorage
{
  "user_id": "anonymous_12345",
  "interactions": [
    {"feed_id": "f1", "action": "like", "timestamp": "2025-10-22T10:00:00Z"},
    {"feed_id": "f2", "action": "dismiss", "timestamp": "2025-10-22T10:05:00Z"}
  ]
}

# When Phase 2 user accounts implemented, migrate to database
CREATE TABLE recommendation_interactions (
  user_id TEXT NOT NULL,
  feed_id TEXT NOT NULL,
  interaction_type TEXT NOT NULL,  -- 'like', 'dismiss', 'follow'
  timestamp TEXT NOT NULL,
  PRIMARY KEY (user_id, feed_id, timestamp)
);

# Build collaborative matrix (user-feed co-occurrence)
CREATE TABLE collaborative_matrix (
  feed_id_1 TEXT NOT NULL,
  feed_id_2 TEXT NOT NULL,
  co_occurrence_score REAL NOT NULL,
  last_updated TEXT NOT NULL,
  PRIMARY KEY (feed_id_1, feed_id_2)
);
```

**Resources**:
- [Scikit-learn Cosine Similarity](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.pairwise.cosine_similarity.html)
- [Content-Based Filtering Guide](https://en.wikipedia.org/wiki/Recommender_system#Content-based_filtering)

---

## 7. Analytics Visualization

### Decision: Chart.js (Primary) with Apache ECharts (Advanced Use Cases)

**Rationale**:
- **MIT License**: Both libraries are free and permissively licensed
- **Chart.js**: Simple, lightweight, great for common charts (bar, line, pie, area)
- **Apache ECharts**: Advanced features (heatmaps, 3D charts, large datasets) if needed
- **CDN or npm**: Flexible deployment, no vendor lock-in
- **React Integration**: Both have React wrappers (`react-chartjs-2`, `echarts-for-react`)
- **Accessibility**: Both support ARIA labels and keyboard navigation
- **Responsive**: Mobile-friendly out-of-the-box

**Alternatives Considered**:
- **D3.js**: Powerful but steep learning curve, overkill for simple charts
- **Plotly**: Great but larger bundle size, less performant for large datasets
- **Recharts**: React-specific, good but less flexible than Chart.js

**Implementation Patterns (Chart.js)**:
```typescript
import { Line, Bar, Pie } from 'react-chartjs-2';

// Trending topics bar chart
<Bar
  data={{
    labels: topicsData.map(t => t.topic),
    datasets: [{
      label: 'Feed Count',
      data: topicsData.map(t => t.count),
      backgroundColor: 'rgba(75, 192, 192, 0.6)'
    }]
  }}
  options={{
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Trending Topics (Last 30 Days)' }
    }
  }}
/>

// Publication velocity line chart
<Line
  data={{
    labels: velocityData.map(d => d.date),
    datasets: [{
      label: 'Posts per Day',
      data: velocityData.map(d => d.count),
      borderColor: 'rgb(75, 192, 192)',
      tension: 0.1
    }]
  }}
  options={{
    responsive: true,
    scales: {
      y: { beginAtZero: true }
    }
  }}
/>
```

**Resources**:
- [Chart.js Documentation](https://www.chartjs.org/docs/latest/)
- [Apache ECharts Documentation](https://echarts.apache.org/en/index.html)

---

## 8. Autocomplete Implementation

### Decision: Pre-built Trie Index (In-Memory)

**Rationale**:
- **Fast Lookups**: O(k) where k = query length, <10ms response time
- **Memory Efficient**: Shared prefixes, ~1-5MB for 10K feeds
- **Simple Implementation**: Python dict-based trie structure
- **Rebuild Strategy**: Nightly refresh when feeds added/modified
- **Fallback**: SQLite FTS5 prefix search if trie fails

**Alternatives Considered**:
- **SQLite LIKE Queries**: Slower (~50-100ms), but acceptable fallback
- **External Service** (e.g., Algolia): Vendor lock-in, costs, privacy concerns

**Implementation Patterns**:
```python
class TrieNode:
    def __init__(self):
        self.children = {}
        self.is_end_of_word = False
        self.suggestions = []  # Top 5 matching feeds

class AutocompleteTrie:
    def __init__(self):
        self.root = TrieNode()
    
    def insert(self, word: str, suggestion: dict):
        node = self.root
        for char in word.lower():
            if char not in node.children:
                node.children[char] = TrieNode()
            node = node.children[char]
            node.suggestions.append(suggestion)
            node.suggestions = sorted(
                node.suggestions, 
                key=lambda x: x['popularity'], 
                reverse=True
            )[:5]  # Keep top 5
        node.is_end_of_word = True
    
    def search(self, prefix: str, limit: int = 5) -> list[dict]:
        node = self.root
        for char in prefix.lower():
            if char not in node.children:
                return []
            node = node.children[char]
        return node.suggestions[:limit]

# Build trie from feeds (nightly job)
trie = AutocompleteTrie()
for feed in db.execute("SELECT title, feed_id, popularity_score FROM feed_sources"):
    trie.insert(feed['title'], {
        'feed_id': feed['feed_id'],
        'title': feed['title'],
        'popularity': feed['popularity_score']
    })

# Autocomplete endpoint
@app.get("/api/autocomplete")
async def autocomplete(q: str):
    suggestions = trie.search(q, limit=5)
    return {"suggestions": suggestions}
```

**Resources**:
- [Trie Data Structure (Wikipedia)](https://en.wikipedia.org/wiki/Trie)

---

## 9. CSV Export (PDF Deferred)

### Decision: Native Python CSV module

**Rationale**:
- **Stdlib**: No external dependencies
- **Fast**: Direct write, no rendering overhead
- **Universal Format**: Importable to Excel, Google Sheets, pandas, etc.
- **Simple**: Single function to generate CSV from SQLite query results

**PDF Export** (Deferred to Phase 2):
- **Playwright** (Apache 2.0): Headless Chrome for high-fidelity chart rendering
- **WeasyPrint** (BSD): HTML-to-PDF, simpler but less accurate for charts
- **Decision**: Wait for user demand, CSV sufficient for MVP

**Implementation Patterns**:
```python
import csv
from io import StringIO

def export_analytics_csv(date_range: str) -> str:
    """Generate CSV export of analytics data"""
    output = StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow(['Date', 'Total Feeds', 'Success Rate', 'Avg Response Time'])
    
    # Data
    rows = db.execute("""
        SELECT 
            DATE(validated_at) as date,
            COUNT(*) as total,
            SUM(CASE WHEN success THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate,
            AVG(response_time) as avg_time
        FROM validation_results
        WHERE validated_at >= DATE('now', ?)
        GROUP BY date
    """, (date_range,)).fetchall()
    
    writer.writerows(rows)
    
    return output.getvalue()

# FastAPI endpoint
@app.get("/api/analytics/export")
async def export_analytics(date_range: str = '-30 days'):
    csv_content = export_analytics_csv(date_range)
    return Response(
        content=csv_content,
        media_type='text/csv',
        headers={'Content-Disposition': 'attachment; filename=analytics.csv'}
    )
```

**Resources**:
- [Python CSV Module](https://docs.python.org/3/library/csv.html)

---

## 10. Configuration Management

### Decision: Pydantic Settings

**Rationale**:
- **Already Used**: Existing codebase uses Pydantic v2
- **Type-Safe**: Automatic validation, type coercion, IDE autocomplete
- **Environment Variables**: Reads from `.env` files and env vars
- **Nested Settings**: Group related configs (e.g., `LoggingSettings`, `EmbeddingSettings`)
- **Validation**: Ensures required settings present, validates formats

**Implementation Patterns**:
```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class EmbeddingSettings(BaseSettings):
    """Embedding generation configuration"""
    provider: str = "local"  # "local" or "huggingface"
    hf_api_token: str = ""
    hf_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    local_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    cache_size: int = 1000
    
    model_config = SettingsConfigDict(env_prefix="AIWF_EMBEDDING_")

class AnalyticsSettings(BaseSettings):
    """Analytics caching configuration"""
    static_cache_ttl: int = 3600  # 1 hour
    dynamic_cache_ttl: int = 300  # 5 minutes
    max_concurrent_queries: int = 10
    
    model_config = SettingsConfigDict(env_prefix="AIWF_ANALYTICS_")

class Settings(BaseSettings):
    """Root configuration"""
    database_url: str = "sqlite:///data/aiwebfeeds.db"
    
    embedding: EmbeddingSettings = EmbeddingSettings()
    analytics: AnalyticsSettings = AnalyticsSettings()
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_nested_delimiter="__"
    )

# Usage
settings = Settings()
print(settings.embedding.provider)  # "local"
print(settings.analytics.static_cache_ttl)  # 3600
```

**Environment Variables**:
```bash
# .env file
AIWF_DATABASE_URL=sqlite:///data/aiwebfeeds.db

# Embedding settings
AIWF_EMBEDDING__PROVIDER=local
AIWF_EMBEDDING__HF_API_TOKEN=hf_...
AIWF_EMBEDDING__LOCAL_MODEL=sentence-transformers/all-MiniLM-L6-v2

# Analytics settings
AIWF_ANALYTICS__STATIC_CACHE_TTL=3600
AIWF_ANALYTICS__DYNAMIC_CACHE_TTL=300
```

**Resources**:
- [Pydantic Settings Documentation](https://docs.pydantic.dev/latest/concepts/pydantic_settings/)

---

## Summary of Technology Stack

| Component | Technology | License | Justification |
|-----------|-----------|---------|---------------|
| **Database** | SQLite 3.40+ | Public Domain | Serverless, FTS5, JSON1, WAL mode |
| **ORM** | SQLModel | MIT | Type-safe models, SQLAlchemy 2.0 |
| **Full-Text Search** | SQLite FTS5 | Built-in | Porter stemming, ranking, no external service |
| **Embeddings (Local)** | Sentence-Transformers | Apache 2.0 | Zero setup, offline, CPU-optimized |
| **Embeddings (API)** | Hugging Face Inference API | Free tier | Optional offload, 1000 req/day |
| **Vector Storage** | NumPy + SQLite BLOB | BSD + Public Domain | Simple, upgrade path to sqlite-vec |
| **ML Framework** | scikit-learn | BSD | Cosine similarity, collaborative filtering (Phase 2) |
| **Caching** | functools.lru_cache | Python stdlib | In-memory, no external service |
| **Visualization** | Chart.js | MIT | Simple, responsive, React integration |
| **Alt Visualization** | Apache ECharts | Apache 2.0 | Advanced charts if needed |
| **CSV Export** | csv module | Python stdlib | Universal format, fast |
| **PDF Export** | Playwright (deferred) | Apache 2.0 | High-fidelity rendering (Phase 2) |
| **Configuration** | Pydantic Settings | MIT | Type-safe, validation, env vars |
| **Progress Bars** | tqdm | MIT/MPL | User feedback for long operations |
| **Logging** | Loguru | MIT | Structured logging, async |

**Total Cost**: $0 (100% free, open-source, permissive licenses)  
**Optional**: Hugging Face API token (free tier: 1000 requests/day)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **SQLite scalability limits** | Low | Medium | WAL mode supports 1000+ readers; upgrade to PostgreSQL if >10K concurrent users |
| **NumPy vector search too slow** | Medium | Low | Brute-force OK for <10K feeds; upgrade to sqlite-vec if >2s latency |
| **HF API rate limits** | Low | Low | Local embeddings as default; HF API is optional enhancement |
| **functools cache memory usage** | Low | Low | LRU eviction automatic; monitor with `lru_cache.cache_info()` |
| **FTS5 relevance tuning** | Medium | Low | Manual ranking adjustments; A/B test query rewriting |

---

**Next Steps**: Proceed to Phase 1 (Design & Contracts) to define data models and API contracts.


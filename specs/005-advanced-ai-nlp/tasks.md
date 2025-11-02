# Implementation Tasks: Phase 5 - Advanced AI/NLP

**Branch**: `005-advanced-ai-nlp`  
**Total Tasks**: 127  
**Estimated Effort**: 5 weeks  
**Last Updated**: 2025-10-27

---

## Task Notation

- 🔵 **Can be done in parallel** with other 🔵 tasks
- 🟡 **Depends on previous task** in same section
- ✅ **Completed**
- 🔄 **In Progress**
- ⏸️ **Blocked** (waiting for dependency)

---

## Phase 5: Setup & Foundation (Tasks 001-015)

### T001: Update Dependencies (🔵 Parallel)

**File**: `packages/ai_web_feeds/pyproject.toml`

**Changes**:
```toml
[project]
dependencies = [
    # ... existing deps ...
    "spacy>=3.7.0",
    "transformers>=4.40.0",
    "torch>=2.0.0",
    "gensim>=4.3.0",
    "langdetect>=1.0.9",
    "scikit-learn>=1.4.0",
]

[project.optional-dependencies]
dev = [
    # ... existing dev deps ...
    "pytest-benchmark>=4.0.0",
]
```

**Acceptance**: `uv sync` completes successfully

---

### T002: Extend Config with Phase5Settings (🔵 Parallel)

**File**: `packages/ai_web_feeds/src/ai_web_feeds/config.py`

**Changes**:
```python
class Phase5Settings(BaseSettings):
    """Phase 5: Advanced AI/NLP Configuration"""
    
    # Batch Processing
    quality_batch_size: int = 100
    entity_batch_size: int = 50
    sentiment_batch_size: int = 100
    
    # Schedule (cron expressions)
    quality_cron: str = "*/30 * * * *"  # Every 30 minutes
    entity_cron: str = "0 * * * *"  # Every hour
    sentiment_cron: str = "0 * * * *"  # Every hour
    topic_modeling_cron: str = "0 3 1 * *"  # 3 AM on 1st of month
    
    # Models
    spacy_model: str = "en_core_web_sm"
    sentiment_model: str = "distilbert-base-uncased-finetuned-sst-2-english"
    topic_model: str = "lda"
    
    # Thresholds
    quality_min_words: int = 100
    entity_confidence_threshold: float = 0.7
    sentiment_shift_threshold: float = 0.3
    topic_coherence_min: float = 0.5
    
    # Resources
    nlp_workers: int = 4
    model_cache_dir: str = "~/.cache/ai_web_feeds/models"
    
    class Config:
        env_prefix = "PHASE5_"

class Settings(BaseSettings):
    # ... existing settings ...
    phase5: Phase5Settings = Field(default_factory=Phase5Settings)
```

**Acceptance**: Config loads with `settings.phase5.quality_batch_size == 100`

---

### T003: Update Environment Variables (🔵 Parallel)

**File**: `env.example`

**Changes**:
```bash
# Phase 5: Advanced AI/NLP Configuration
PHASE5_QUALITY_BATCH_SIZE=100
PHASE5_ENTITY_BATCH_SIZE=50
PHASE5_SENTIMENT_BATCH_SIZE=100
PHASE5_SPACY_MODEL=en_core_web_sm
PHASE5_SENTIMENT_MODEL=distilbert-base-uncased-finetuned-sst-2-english
PHASE5_NLP_WORKERS=4
PHASE5_MODEL_CACHE_DIR=~/.cache/ai_web_feeds/models
```

**Acceptance**: `.env` file contains Phase 5 variables

---

### T004: Run Database Migration (🟡 After T001-T003)

**File**: Create `packages/ai_web_feeds/src/ai_web_feeds/migrations/005_add_nlp_tables.sql`

**Content**: Use SQL from `plan.md` (complete migration script)

**File**: Create `packages/ai_web_feeds/src/ai_web_feeds/migrations/run_migration.py`

**Content**:
```python
from pathlib import Path
import sqlite3
from ai_web_feeds.config import Settings

def run_migration_005():
    """Run Phase 5 migration: Add NLP tables"""
    settings = Settings()
    migration_sql = Path(__file__).parent / "005_add_nlp_tables.sql"
    
    with sqlite3.connect(settings.database_url.replace("sqlite:///", "")) as conn:
        conn.executescript(migration_sql.read_text())
        print("✅ Migration 005 completed: NLP tables added")

if __name__ == "__main__":
    run_migration_005()
```

**Run**: `uv run python packages/ai_web_feeds/src/ai_web_feeds/migrations/run_migration.py`

**Acceptance**: 
- 8 new tables created: `article_quality_scores`, `entities`, `entity_mentions`, `article_sentiment`, `topic_sentiment_daily`, `subtopics`, `topic_evolution_events`, `entities_fts`
- `feed_entries` extended with `*_processed` columns
- Verify with: `sqlite3 data/aiwebfeeds.db ".tables"`

---

### T005: Add SQLModel Classes for Phase 5 Tables (🟡 After T004)

**File**: `packages/ai_web_feeds/src/ai_web_feeds/models.py`

**Changes**: Add 8 new SQLModel classes:

```python
from sqlmodel import Field, SQLModel
from datetime import datetime
from typing import Optional
import uuid

# Quality Scoring
class ArticleQualityScore(SQLModel, table=True):
    __tablename__ = "article_quality_scores"
    
    article_id: int = Field(foreign_key="feed_entries.id", primary_key=True)
    overall_score: int = Field(ge=0, le=100)
    depth_score: Optional[int] = Field(default=None, ge=0, le=100)
    reference_score: Optional[int] = Field(default=None, ge=0, le=100)
    author_score: Optional[int] = Field(default=None, ge=0, le=100)
    domain_score: Optional[int] = Field(default=None, ge=0, le=100)
    engagement_score: Optional[int] = Field(default=None, ge=0, le=100)
    computed_at: datetime = Field(default_factory=datetime.utcnow)

# Entity Extraction
class Entity(SQLModel, table=True):
    __tablename__ = "entities"
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    canonical_name: str = Field(unique=True)
    entity_type: str = Field(regex="^(person|organization|technique|dataset|concept)$")
    aliases: Optional[str] = Field(default=None)  # JSON array
    description: Optional[str] = Field(default=None)
    metadata: Optional[str] = Field(default=None)  # JSON object
    frequency_count: int = Field(default=0)
    first_seen: datetime = Field(default_factory=datetime.utcnow)
    last_seen: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class EntityMention(SQLModel, table=True):
    __tablename__ = "entity_mentions"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    entity_id: str = Field(foreign_key="entities.id")
    article_id: int = Field(foreign_key="feed_entries.id")
    confidence: float = Field(ge=0.0, le=1.0)
    extraction_method: str = Field(regex="^(ner_model|rule_based|manual)$")
    context: Optional[str] = Field(default=None)
    mentioned_at: datetime = Field(default_factory=datetime.utcnow)

# Sentiment Analysis
class ArticleSentiment(SQLModel, table=True):
    __tablename__ = "article_sentiment"
    
    article_id: int = Field(foreign_key="feed_entries.id", primary_key=True)
    sentiment_score: float = Field(ge=-1.0, le=1.0)
    classification: str = Field(regex="^(positive|neutral|negative)$")
    model_name: str
    confidence: float = Field(ge=0.0, le=1.0)
    computed_at: datetime = Field(default_factory=datetime.utcnow)

class TopicSentimentDaily(SQLModel, table=True):
    __tablename__ = "topic_sentiment_daily"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    topic: str
    date: str  # DATE string
    avg_sentiment: float
    article_count: int
    positive_count: int = Field(default=0)
    neutral_count: int = Field(default=0)
    negative_count: int = Field(default=0)

# Topic Modeling
class Subtopic(SQLModel, table=True):
    __tablename__ = "subtopics"
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    parent_topic: str
    name: str
    keywords: str  # JSON array
    description: Optional[str] = Field(default=None)
    article_count: int = Field(default=0)
    detected_at: datetime = Field(default_factory=datetime.utcnow)
    approved: bool = Field(default=False)
    created_by: str = Field(default="system")

class TopicEvolutionEvent(SQLModel, table=True):
    __tablename__ = "topic_evolution_events"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    event_type: str = Field(regex="^(split|merge|emergence|decline)$")
    source_topic: Optional[str] = Field(default=None)
    target_topics: Optional[str] = Field(default=None)  # JSON array
    article_count: int
    growth_rate: Optional[float] = Field(default=None)
    detected_at: datetime = Field(default_factory=datetime.utcnow)
```

**Acceptance**: Models import successfully: `from ai_web_feeds.models import ArticleQualityScore, Entity`

---

### T006: Extend Storage with Phase 5 CRUD Methods (🟡 After T005)

**File**: `packages/ai_web_feeds/src/ai_web_feeds/storage.py`

**Changes**: Add methods for each new model (30+ methods total):

```python
from ai_web_feeds.models import (
    ArticleQualityScore,
    Entity,
    EntityMention,
    ArticleSentiment,
    TopicSentimentDaily,
    Subtopic,
    TopicEvolutionEvent,
)

class Storage:
    # ... existing methods ...
    
    # -------------------------------------------------------------------------
    # Quality Scoring
    # -------------------------------------------------------------------------
    def add_quality_score(
        self,
        article_id: int,
        overall_score: int,
        depth_score: int = None,
        reference_score: int = None,
        author_score: int = None,
        domain_score: int = None,
        engagement_score: int = None,
    ) -> ArticleQualityScore:
        """Add quality score for article"""
        quality = ArticleQualityScore(
            article_id=article_id,
            overall_score=overall_score,
            depth_score=depth_score,
            reference_score=reference_score,
            author_score=author_score,
            domain_score=domain_score,
            engagement_score=engagement_score,
        )
        self.session.add(quality)
        self.session.commit()
        return quality
    
    def get_quality_score(self, article_id: int) -> Optional[ArticleQualityScore]:
        """Get quality score for article"""
        return self.session.get(ArticleQualityScore, article_id)
    
    def get_unprocessed_articles_for_quality(self, limit: int = 100) -> list:
        """Get articles that haven't been quality scored"""
        query = """
            SELECT id, title, content, feed_id, published_at
            FROM feed_entries
            WHERE quality_processed = FALSE 
              AND LENGTH(content) > 100
            ORDER BY published_at DESC
            LIMIT :limit
        """
        result = self.session.execute(text(query), {"limit": limit})
        return [dict(row._mapping) for row in result]
    
    def mark_quality_processed(self, article_id: int) -> None:
        """Mark article as quality processed"""
        query = """
            UPDATE feed_entries 
            SET quality_processed = TRUE, 
                quality_processed_at = CURRENT_TIMESTAMP
            WHERE id = :article_id
        """
        self.session.execute(text(query), {"article_id": article_id})
        self.session.commit()
    
    # -------------------------------------------------------------------------
    # Entity Extraction
    # -------------------------------------------------------------------------
    def create_entity(
        self,
        canonical_name: str,
        entity_type: str,
        aliases: list[str] = None,
        description: str = None,
        metadata: dict = None,
    ) -> Entity:
        """Create new entity"""
        import json
        
        entity = Entity(
            canonical_name=canonical_name,
            entity_type=entity_type,
            aliases=json.dumps(aliases) if aliases else None,
            description=description,
            metadata=json.dumps(metadata) if metadata else None,
        )
        self.session.add(entity)
        self.session.commit()
        return entity
    
    def get_entity_by_name(self, canonical_name: str) -> Optional[Entity]:
        """Get entity by canonical name"""
        stmt = select(Entity).where(Entity.canonical_name == canonical_name)
        return self.session.exec(stmt).first()
    
    def search_entities_fts(self, query: str, limit: int = 20) -> list[Entity]:
        """Full-text search entities"""
        sql = """
            SELECT e.* 
            FROM entities e
            JOIN entities_fts fts ON e.id = fts.entity_id
            WHERE entities_fts MATCH :query
            ORDER BY rank
            LIMIT :limit
        """
        result = self.session.execute(text(sql), {"query": query, "limit": limit})
        return [Entity.model_validate(dict(row._mapping)) for row in result]
    
    def create_entity_mention(
        self,
        entity_id: str,
        article_id: int,
        confidence: float,
        extraction_method: str,
        context: str = None,
    ) -> EntityMention:
        """Record entity mention in article"""
        mention = EntityMention(
            entity_id=entity_id,
            article_id=article_id,
            confidence=confidence,
            extraction_method=extraction_method,
            context=context,
        )
        self.session.add(mention)
        self.session.commit()
        return mention
    
    def get_entity_mentions(self, entity_id: str, limit: int = 50) -> list[EntityMention]:
        """Get all mentions of entity"""
        stmt = (
            select(EntityMention)
            .where(EntityMention.entity_id == entity_id)
            .order_by(EntityMention.mentioned_at.desc())
            .limit(limit)
        )
        return list(self.session.exec(stmt))
    
    def get_unprocessed_articles_for_entities(self, limit: int = 50) -> list:
        """Get articles that haven't been entity processed"""
        query = """
            SELECT id, title, content, published_at
            FROM feed_entries
            WHERE entities_processed = FALSE 
              AND LENGTH(content) > 100
            ORDER BY published_at DESC
            LIMIT :limit
        """
        result = self.session.execute(text(query), {"limit": limit})
        return [dict(row._mapping) for row in result]
    
    def mark_entities_processed(self, article_id: int) -> None:
        """Mark article as entity processed"""
        query = """
            UPDATE feed_entries 
            SET entities_processed = TRUE, 
                entities_processed_at = CURRENT_TIMESTAMP
            WHERE id = :article_id
        """
        self.session.execute(text(query), {"article_id": article_id})
        self.session.commit()
    
    # -------------------------------------------------------------------------
    # Sentiment Analysis
    # -------------------------------------------------------------------------
    def add_sentiment(
        self,
        article_id: int,
        sentiment_score: float,
        classification: str,
        model_name: str,
        confidence: float,
    ) -> ArticleSentiment:
        """Add sentiment analysis result"""
        sentiment = ArticleSentiment(
            article_id=article_id,
            sentiment_score=sentiment_score,
            classification=classification,
            model_name=model_name,
            confidence=confidence,
        )
        self.session.add(sentiment)
        self.session.commit()
        return sentiment
    
    def get_unprocessed_articles_for_sentiment(self, limit: int = 100) -> list:
        """Get articles that haven't been sentiment analyzed"""
        query = """
            SELECT id, title, content, published_at
            FROM feed_entries
            WHERE sentiment_processed = FALSE 
              AND LENGTH(content) > 100
            ORDER BY published_at DESC
            LIMIT :limit
        """
        result = self.session.execute(text(query), {"limit": limit})
        return [dict(row._mapping) for row in result]
    
    def mark_sentiment_processed(self, article_id: int) -> None:
        """Mark article as sentiment processed"""
        query = """
            UPDATE feed_entries 
            SET sentiment_processed = TRUE, 
                sentiment_processed_at = CURRENT_TIMESTAMP
            WHERE id = :article_id
        """
        self.session.execute(text(query), {"article_id": article_id})
        self.session.commit()
    
    def upsert_topic_sentiment_daily(
        self,
        topic: str,
        date: str,
        avg_sentiment: float,
        article_count: int,
        positive_count: int = 0,
        neutral_count: int = 0,
        negative_count: int = 0,
    ) -> TopicSentimentDaily:
        """Insert or update daily topic sentiment"""
        query = """
            INSERT OR REPLACE INTO topic_sentiment_daily 
            (topic, date, avg_sentiment, article_count, positive_count, neutral_count, negative_count)
            VALUES (:topic, :date, :avg_sentiment, :article_count, :positive_count, :neutral_count, :negative_count)
        """
        self.session.execute(text(query), {
            "topic": topic,
            "date": date,
            "avg_sentiment": avg_sentiment,
            "article_count": article_count,
            "positive_count": positive_count,
            "neutral_count": neutral_count,
            "negative_count": negative_count,
        })
        self.session.commit()
        
        # Return the created/updated record
        stmt = select(TopicSentimentDaily).where(
            TopicSentimentDaily.topic == topic,
            TopicSentimentDaily.date == date,
        )
        return self.session.exec(stmt).first()
    
    def get_topic_sentiment_trend(
        self, topic: str, days: int = 30
    ) -> list[TopicSentimentDaily]:
        """Get sentiment trend for topic over N days"""
        from datetime import datetime, timedelta
        
        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=days)
        
        stmt = (
            select(TopicSentimentDaily)
            .where(
                TopicSentimentDaily.topic == topic,
                TopicSentimentDaily.date >= str(start_date),
                TopicSentimentDaily.date <= str(end_date),
            )
            .order_by(TopicSentimentDaily.date.asc())
        )
        return list(self.session.exec(stmt))
    
    # -------------------------------------------------------------------------
    # Topic Modeling
    # -------------------------------------------------------------------------
    def create_subtopic(
        self,
        parent_topic: str,
        name: str,
        keywords: list[str],
        description: str = None,
        article_count: int = 0,
    ) -> Subtopic:
        """Create detected subtopic"""
        import json
        
        subtopic = Subtopic(
            parent_topic=parent_topic,
            name=name,
            keywords=json.dumps(keywords),
            description=description,
            article_count=article_count,
        )
        self.session.add(subtopic)
        self.session.commit()
        return subtopic
    
    def get_unapproved_subtopics(self) -> list[Subtopic]:
        """Get subtopics awaiting manual approval"""
        stmt = select(Subtopic).where(Subtopic.approved == False)
        return list(self.session.exec(stmt))
    
    def approve_subtopic(self, subtopic_id: str) -> None:
        """Approve subtopic"""
        query = "UPDATE subtopics SET approved = TRUE WHERE id = :id"
        self.session.execute(text(query), {"id": subtopic_id})
        self.session.commit()
    
    def create_topic_evolution_event(
        self,
        event_type: str,
        article_count: int,
        source_topic: str = None,
        target_topics: list[str] = None,
        growth_rate: float = None,
    ) -> TopicEvolutionEvent:
        """Record topic evolution event"""
        import json
        
        event = TopicEvolutionEvent(
            event_type=event_type,
            source_topic=source_topic,
            target_topics=json.dumps(target_topics) if target_topics else None,
            article_count=article_count,
            growth_rate=growth_rate,
        )
        self.session.add(event)
        self.session.commit()
        return event
```

**Acceptance**: Storage methods work:
```python
storage = Storage()
storage.add_quality_score(article_id=1, overall_score=85)
assert storage.get_quality_score(1).overall_score == 85
```

---

### T007: Create NLP Package Structure (🔵 Parallel)

**Files**: Create directory structure:

```bash
mkdir -p packages/ai_web_feeds/src/ai_web_feeds/nlp
touch packages/ai_web_feeds/src/ai_web_feeds/nlp/__init__.py
touch packages/ai_web_feeds/src/ai_web_feeds/nlp/quality_scorer.py
touch packages/ai_web_feeds/src/ai_web_feeds/nlp/entity_extractor.py
touch packages/ai_web_feeds/src/ai_web_feeds/nlp/sentiment_analyzer.py
touch packages/ai_web_feeds/src/ai_web_feeds/nlp/topic_modeler.py
touch packages/ai_web_feeds/src/ai_web_feeds/nlp/utils.py
```

**`nlp/__init__.py`**:
```python
"""NLP processing modules for Phase 5"""

from .quality_scorer import QualityScorer
from .entity_extractor import EntityExtractor
from .sentiment_analyzer import SentimentAnalyzer
from .topic_modeler import TopicModeler

__all__ = [
    "QualityScorer",
    "EntityExtractor",
    "SentimentAnalyzer",
    "TopicModeler",
]
```

**Acceptance**: Import works: `from ai_web_feeds.nlp import QualityScorer`

---

### T008: Create Test Fixtures (🔵 Parallel)

**Files**: Create test data:

**`tests/fixtures/sample_articles.json`**:
```json
[
  {
    "id": 1,
    "title": "Attention Is All You Need: The Transformer Revolution",
    "content": "The Transformer architecture, introduced by Vaswani et al. in 2017, revolutionized natural language processing. Unlike previous approaches that relied on recurrent neural networks, Transformers use self-attention mechanisms to process entire sequences in parallel. This breakthrough enabled models like BERT and GPT to achieve state-of-the-art results across multiple benchmarks. The paper has been cited over 50,000 times, making it one of the most influential works in AI history. Key researchers include Ashish Vaswani from Google Brain and Ilya Sutskever from OpenAI.",
    "published_at": "2023-01-15T10:00:00Z",
    "feed_id": "arxiv-nlp",
    "topics": ["NLP", "Transformers", "Attention Mechanisms"]
  },
  {
    "id": 2,
    "title": "RLHF and Alignment: A Critical Analysis",
    "content": "Reinforcement Learning from Human Feedback (RLHF) has emerged as a crucial technique for aligning large language models with human values. However, recent research by Anthropic and OpenAI has revealed significant limitations. The alignment problem remains fundamentally unsolved, with models still exhibiting unexpected behaviors. Critics like Eliezer Yudkowsky have raised concerns about the long-term safety implications.",
    "published_at": "2023-02-20T14:30:00Z",
    "feed_id": "ai-safety",
    "topics": ["AI Safety", "RLHF", "Alignment"]
  },
  {
    "id": 3,
    "title": "Short Article",
    "content": "This is too short.",
    "published_at": "2023-03-10T08:00:00Z",
    "feed_id": "test",
    "topics": []
  }
]
```

**`tests/fixtures/mock_entities.json`**:
```json
{
  "article_1": [
    {"text": "Transformer", "type": "technique", "confidence": 0.95},
    {"text": "Ashish Vaswani", "type": "person", "confidence": 0.92},
    {"text": "Google Brain", "type": "organization", "confidence": 0.88},
    {"text": "OpenAI", "type": "organization", "confidence": 0.91},
    {"text": "Ilya Sutskever", "type": "person", "confidence": 0.89},
    {"text": "BERT", "type": "technique", "confidence": 0.94},
    {"text": "GPT", "type": "technique", "confidence": 0.96}
  ],
  "article_2": [
    {"text": "RLHF", "type": "technique", "confidence": 0.97},
    {"text": "Anthropic", "type": "organization", "confidence": 0.90},
    {"text": "OpenAI", "type": "organization", "confidence": 0.91},
    {"text": "Eliezer Yudkowsky", "type": "person", "confidence": 0.88}
  ]
}
```

**Acceptance**: Fixtures load successfully in tests

---

### T009-T015: Test Infrastructure Setup (🔵 Parallel)

Create test files with placeholder tests:

- T009: `tests/tests/packages/ai_web_feeds/nlp/test_quality_scorer.py`
- T010: `tests/tests/packages/ai_web_feeds/nlp/test_entity_extractor.py`
- T011: `tests/tests/packages/ai_web_feeds/nlp/test_sentiment_analyzer.py`
- T012: `tests/tests/packages/ai_web_feeds/nlp/test_topic_modeler.py`
- T013: `tests/tests/packages/ai_web_feeds/nlp/test_nlp_scheduler.py`
- T014: `tests/tests/packages/ai_web_feeds/nlp/__init__.py`
- T015: Update `tests/conftest.py` with NLP-specific fixtures

**Acceptance**: `uv run pytest tests/tests/packages/ai_web_feeds/nlp/` runs (even if tests are empty)

---

## Phase 5A: Quality Scoring (Tasks 016-035)

### T016: Implement QualityScorer Class (🟡 After T007)

**File**: `packages/ai_web_feeds/src/ai_web_feeds/nlp/quality_scorer.py`

**Content**:
```python
"""Quality scoring for articles based on heuristics"""

from typing import Optional
from loguru import logger
from ai_web_feeds.config import Settings


class QualityScorer:
    """Compute article quality scores using heuristic analysis"""
    
    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or Settings()
        self.config = self.settings.phase5
    
    def score_article(self, article: dict) -> dict:
        """
        Compute overall quality score and component scores
        
        Args:
            article: Dict with keys: id, title, content, feed_id
        
        Returns:
            Dict with scores: {
                "overall_score": 85,
                "depth_score": 90,
                "reference_score": 75,
                "author_score": 50,
                "domain_score": 80,
                "engagement_score": 60
            }
        """
        content = article.get("content", "")
        title = article.get("title", "")
        
        # Component scores
        depth = self._compute_depth_score(content, title)
        references = self._compute_reference_score(content)
        author = self._compute_author_score(article)
        domain = self._compute_domain_score(article.get("feed_id"))
        engagement = self._compute_engagement_score(article)
        
        # Weighted overall score
        overall = int(
            depth * 0.25 +
            references * 0.20 +
            author * 0.15 +
            domain * 0.25 +
            engagement * 0.15
        )
        
        logger.debug(
            f"Quality scored article {article.get('id')}: "
            f"overall={overall}, depth={depth}, refs={references}"
        )
        
        return {
            "overall_score": overall,
            "depth_score": depth,
            "reference_score": references,
            "author_score": author,
            "domain_score": domain,
            "engagement_score": engagement,
        }
    
    def _compute_depth_score(self, content: str, title: str) -> int:
        """Score based on content depth (word count, structure)"""
        words = len(content.split())
        paragraphs = content.count("\n\n") + 1
        
        score = 0
        
        # Word count: >1500 words = +20
        if words >= 1500:
            score += 20
        elif words >= 1000:
            score += 15
        elif words >= 500:
            score += 10
        elif words >= 200:
            score += 5
        
        # Paragraph structure: >5 paragraphs = +10
        if paragraphs >= 5:
            score += 10
        elif paragraphs >= 3:
            score += 5
        
        # Code blocks: presence of ``` or <code> = +10
        if "```" in content or "<code>" in content:
            score += 10
        
        # Images/diagrams: ![...] or <img> = +5
        if "![" in content or "<img" in content:
            score += 5
        
        # Headings: presence of ## or <h2> = +10
        if "##" in content or "<h2" in content:
            score += 10
        
        return min(score, 100)
    
    def _compute_reference_score(self, content: str) -> int:
        """Score based on external references"""
        import re
        
        # Count external links
        url_pattern = r'https?://[^\s<>"{}|\\^`[\]]+'
        urls = re.findall(url_pattern, content)
        
        score = 0
        
        # External links: ≥3 = +15
        if len(urls) >= 3:
            score += 15
        elif len(urls) >= 1:
            score += 10
        
        # Academic citations: DOI, arXiv, etc.
        if "doi.org" in content or "arxiv.org" in content:
            score += 10
        
        # Reputable domains: .edu, .org
        reputable_count = sum(1 for url in urls if ".edu" in url or ".org" in url)
        if reputable_count >= 1:
            score += 5
        
        return min(score, 100)
    
    def _compute_author_score(self, article: dict) -> int:
        """Score based on author authority (placeholder for now)"""
        # TODO: Implement author bio detection, credentials, h-index
        # For now, return default score
        return 50
    
    def _compute_domain_score(self, feed_id: str) -> int:
        """Score based on feed reputation (placeholder for now)"""
        # TODO: Implement feed reputation scoring
        # For now, return default score based on feed type
        if not feed_id:
            return 50
        
        # Simple heuristic: certain feeds are high quality
        high_quality_feeds = ["arxiv", "nature", "science", "acm"]
        if any(hq in feed_id.lower() for hq in high_quality_feeds):
            return 90
        
        return 60
    
    def _compute_engagement_score(self, article: dict) -> int:
        """Score based on engagement signals (placeholder for now)"""
        # TODO: Implement read time tracking, shares, etc.
        # For now, return default score
        return 50
```

**Acceptance**: 
- `scorer = QualityScorer()` initializes
- `scorer.score_article(sample_article)` returns dict with 6 scores

---

### T017-T022: Implement QualityScorer Tests (🔵 Parallel after T016)

**File**: `tests/tests/packages/ai_web_feeds/nlp/test_quality_scorer.py`

Tests to implement:
- T017: `test_score_high_quality_article` (long, well-structured, many links)
- T018: `test_score_low_quality_article` (short, no links, poor structure)
- T019: `test_depth_score_calculation` (various word counts)
- T020: `test_reference_score_calculation` (various link counts)
- T021: `test_score_article_with_code_blocks` (+10 depth)
- T022: `test_score_article_with_academic_citations` (+10 reference)

**Acceptance**: All quality scorer tests pass with ≥90% coverage

---

### T023: Create Quality Scoring Batch Job (🟡 After T016)

**File**: `packages/ai_web_feeds/src/ai_web_feeds/nlp_scheduler.py` (create new file)

**Content**:
```python
"""NLP batch processing jobs for APScheduler"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from loguru import logger
from ai_web_feeds.config import Settings
from ai_web_feeds.storage import Storage
from ai_web_feeds.nlp import QualityScorer


class NLPScheduler:
    """Manage NLP batch processing jobs"""
    
    def __init__(self, scheduler: AsyncIOScheduler, settings: Settings = None):
        self.scheduler = scheduler
        self.settings = settings or Settings()
        self.config = self.settings.phase5
        self.storage = Storage()
        
        # Initialize NLP modules
        self.quality_scorer = QualityScorer(self.settings)
    
    def register_jobs(self):
        """Register all NLP batch jobs"""
        logger.info("Registering NLP batch jobs")
        
        # Quality scoring: every 30 minutes
        self.scheduler.add_job(
            self._process_quality_batch,
            trigger="cron",
            minute="*/30",
            id="nlp_quality_batch",
            replace_existing=True,
        )
        
        logger.info("✅ NLP jobs registered")
    
    async def _process_quality_batch(self):
        """Process batch of articles for quality scoring"""
        batch_size = self.config.quality_batch_size
        logger.info(f"Starting quality scoring batch (size={batch_size})")
        
        try:
            # Get unprocessed articles
            articles = self.storage.get_unprocessed_articles_for_quality(batch_size)
            
            if not articles:
                logger.debug("No articles to process for quality scoring")
                return
            
            success_count = 0
            failure_count = 0
            
            for article in articles:
                try:
                    # Compute quality scores
                    scores = self.quality_scorer.score_article(article)
                    
                    # Store in database
                    self.storage.add_quality_score(
                        article_id=article["id"],
                        **scores
                    )
                    
                    # Mark as processed
                    self.storage.mark_quality_processed(article["id"])
                    
                    success_count += 1
                    
                except Exception as e:
                    logger.error(f"Failed to score article {article['id']}: {e}")
                    failure_count += 1
            
            logger.info(
                f"Quality scoring batch complete: "
                f"{success_count} success, {failure_count} failed"
            )
            
        except Exception as e:
            logger.error(f"Quality scoring batch failed: {e}")
```

**Acceptance**: Scheduler registers quality job

---

### T024: Integrate NLP Scheduler with Main Scheduler (🟡 After T023)

**File**: `packages/ai_web_feeds/src/ai_web_feeds/scheduler.py`

**Changes**:
```python
from ai_web_feeds.nlp_scheduler import NLPScheduler

class SchedulerManager:
    def __init__(self):
        # ... existing init ...
        self.nlp_scheduler = NLPScheduler(self.scheduler, self.settings)
    
    def start(self):
        # ... existing jobs ...
        
        # Register NLP jobs
        self.nlp_scheduler.register_jobs()
        
        # ... rest of start method ...
```

**Acceptance**: `scheduler.start()` registers NLP jobs without errors

---

### T025-T030: CLI Commands for Quality Scoring (🔵 Parallel after T023)

**File**: `apps/cli/ai_web_feeds/cli/commands/nlp.py` (create new file)

**Content**:
```python
"""CLI commands for NLP operations"""

import typer
from rich.console import Console
from rich.table import Table
from ai_web_feeds.config import Settings
from ai_web_feeds.storage import Storage
from ai_web_feeds.nlp import QualityScorer

app = typer.Typer(help="NLP processing commands")
console = Console()

@app.command()
def process_quality(
    batch_size: int = typer.Option(100, "--batch-size", "-b", help="Number of articles to process"),
):
    """Manually trigger quality scoring batch"""
    console.print(f"[blue]Processing quality scores for {batch_size} articles...[/blue]")
    
    settings = Settings()
    storage = Storage()
    scorer = QualityScorer(settings)
    
    articles = storage.get_unprocessed_articles_for_quality(batch_size)
    
    if not articles:
        console.print("[yellow]No articles to process[/yellow]")
        return
    
    for article in articles:
        scores = scorer.score_article(article)
        storage.add_quality_score(article_id=article["id"], **scores)
        storage.mark_quality_processed(article["id"])
        console.print(f"✅ Article {article['id']}: {scores['overall_score']}/100")
    
    console.print(f"[green]Processed {len(articles)} articles[/green]")


@app.command()
def stats():
    """Show NLP processing statistics"""
    storage = Storage()
    
    # Query stats
    query = """
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN quality_processed THEN 1 ELSE 0 END) as quality_done,
            SUM(CASE WHEN entities_processed THEN 1 ELSE 0 END) as entities_done,
            SUM(CASE WHEN sentiment_processed THEN 1 ELSE 0 END) as sentiment_done
        FROM feed_entries
    """
    result = storage.session.execute(query).first()
    
    table = Table(title="NLP Processing Stats")
    table.add_column("Metric", style="cyan")
    table.add_column("Count", style="magenta", justify="right")
    table.add_column("Percentage", style="green", justify="right")
    
    total = result[0]
    table.add_row("Total Articles", str(total), "100%")
    table.add_row(
        "Quality Processed", 
        str(result[1]), 
        f"{result[1] / total * 100:.1f}%" if total > 0 else "0%"
    )
    table.add_row(
        "Entities Processed", 
        str(result[2]), 
        f"{result[2] / total * 100:.1f}%" if total > 0 else "0%"
    )
    table.add_row(
        "Sentiment Processed", 
        str(result[3]), 
        f"{result[3] / total * 100:.1f}%" if total > 0 else "0%"
    )
    
    console.print(table)


# More commands will be added in subsequent tasks...
```

**Acceptance**: 
- `aiwebfeeds nlp process-quality` runs
- `aiwebfeeds nlp stats` shows processing stats

---

### T031: Register NLP CLI Module (🟡 After T025)

**File**: `apps/cli/ai_web_feeds/cli/__init__.py`

**Changes**:
```python
from ai_web_feeds.cli.commands import nlp

# Register nlp module
app.add_typer(nlp.app, name="nlp")
```

**Acceptance**: `aiwebfeeds nlp --help` shows available commands

---

### T032-T035: Documentation for Quality Scoring (🔵 Parallel)

- T032: Create `apps/web/content/docs/features/quality-scoring.mdx`
- T033: Add examples, API reference, troubleshooting
- T034: Update `apps/web/content/docs/meta.json` to include quality-scoring
- T035: Test documentation builds: `cd apps/web && pnpm build`

**Acceptance**: Documentation site builds, quality-scoring page renders

---

## Phase 5B: Entity Extraction (Tasks 036-060)

### T036: Install spaCy Model (🔵)

**Command**: 
```bash
uv run python -m spacy download en_core_web_sm
```

**Acceptance**: Model downloads successfully (~13MB)

---

### T037: Implement EntityExtractor Class (🟡 After T036)

**File**: `packages/ai_web_feeds/src/ai_web_feeds/nlp/entity_extractor.py`

**Content**:
```python
"""Entity extraction using spaCy NER"""

import spacy
from typing import Optional, List, Dict
from loguru import logger
from ai_web_feeds.config import Settings
from Levenshtein import distance as levenshtein_distance


class EntityExtractor:
    """Extract and normalize entities from article text"""
    
    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or Settings()
        self.config = self.settings.phase5
        
        # Load spaCy model
        try:
            self.nlp = spacy.load(self.config.spacy_model)
            logger.info(f"Loaded spaCy model: {self.config.spacy_model}")
        except OSError:
            logger.warning(
                f"spaCy model '{self.config.spacy_model}' not found. "
                "Downloading..."
            )
            import subprocess
            subprocess.run([
                "python", "-m", "spacy", "download", self.config.spacy_model
            ])
            self.nlp = spacy.load(self.config.spacy_model)
    
    def extract_entities(self, article: dict) -> List[Dict]:
        """
        Extract entities from article content
        
        Returns:
            List of dicts: [
                {
                    "text": "Geoffrey Hinton",
                    "type": "person",
                    "confidence": 0.92,
                    "context": "...Geoffrey Hinton discusses..."
                },
                ...
            ]
        """
        content = article.get("content", "")
        
        if len(content) < 100:
            logger.debug(f"Article {article.get('id')} too short for entity extraction")
            return []
        
        # Run spaCy NER
        doc = self.nlp(content[:10000])  # Limit to 10k chars to avoid OOM
        
        entities = []
        for ent in doc.ents:
            entity_type = self._map_spacy_label(ent.label_)
            
            if entity_type:  # Only keep mapped entity types
                entities.append({
                    "text": ent.text,
                    "type": entity_type,
                    "confidence": self._compute_confidence(ent),
                    "context": self._extract_context(ent, doc),
                })
        
        logger.debug(f"Extracted {len(entities)} entities from article {article.get('id')}")
        return entities
    
    def _map_spacy_label(self, label: str) -> Optional[str]:
        """Map spaCy entity labels to our schema"""
        mapping = {
            "PERSON": "person",
            "ORG": "organization",
            "GPE": "organization",  # Geo-political entities often refer to orgs
            "PRODUCT": "technique",  # Products often are AI models/techniques
            "NORP": None,  # Nationalities/religious/political groups - skip
            "FAC": None,  # Facilities - skip
            "LOC": None,  # Locations - skip for now
            "EVENT": None,  # Events - skip for now
        }
        return mapping.get(label)
    
    def _compute_confidence(self, ent) -> float:
        """Compute confidence score for entity"""
        # spaCy doesn't provide confidence directly
        # Use heuristics: longer entities = higher confidence
        length_bonus = min(len(ent.text.split()) / 5, 0.2)
        base_confidence = 0.75
        return min(base_confidence + length_bonus, 1.0)
    
    def _extract_context(self, ent, doc, window=50) -> str:
        """Extract surrounding context for entity"""
        start = max(0, ent.start_char - window)
        end = min(len(doc.text), ent.end_char + window)
        return doc.text[start:end]
    
    def normalize_entity(self, text: str, entity_type: str, existing_entities: List[str]) -> str:
        """
        Normalize entity name by finding similar canonical names
        
        Args:
            text: Raw entity text
            entity_type: Entity type (person, organization, etc.)
            existing_entities: List of existing canonical names
        
        Returns:
            Normalized canonical name (either existing or new)
        """
        # Simple normalization: title case
        normalized = text.strip().title()
        
        # Check for similar existing entities (Levenshtein distance ≤2)
        threshold = 2
        for existing in existing_entities:
            if entity_type == self._infer_type(existing):
                dist = levenshtein_distance(normalized.lower(), existing.lower())
                if dist <= threshold:
                    logger.debug(f"Merged '{normalized}' → '{existing}' (dist={dist})")
                    return existing
        
        return normalized
    
    def _infer_type(self, canonical_name: str) -> str:
        """Infer entity type from canonical name (placeholder)"""
        # TODO: Implement smarter type inference
        # For now, assume person if name has 2-3 words
        words = canonical_name.split()
        if 2 <= len(words) <= 3:
            return "person"
        return "organization"
```

**Acceptance**:
- `extractor = EntityExtractor()` initializes
- `extractor.extract_entities(sample_article)` returns list of entity dicts

---

### T038-T045: Implement EntityExtractor Tests (🔵 Parallel after T037)

Tests to implement:
- T038: `test_extract_entities_from_article`
- T039: `test_extract_entities_empty_content`
- T040: `test_map_spacy_labels`
- T041: `test_normalize_entity_exact_match`
- T042: `test_normalize_entity_similar_name` (Levenshtein)
- T043: `test_normalize_entity_new_name`
- T044: `test_extract_context_window`
- T045: `test_compute_confidence_heuristic`

**Acceptance**: All entity extractor tests pass with ≥90% coverage

---

### T046: Create Entity Extraction Batch Job (🟡 After T037)

**File**: `packages/ai_web_feeds/src/ai_web_feeds/nlp_scheduler.py`

**Changes**: Add to `NLPScheduler` class:

```python
def __init__(self, ...):
    # ... existing init ...
    self.entity_extractor = EntityExtractor(self.settings)

def register_jobs(self):
    # ... existing jobs ...
    
    # Entity extraction: every hour
    self.scheduler.add_job(
        self._process_entities_batch,
        trigger="cron",
        minute="0",
        id="nlp_entities_batch",
        replace_existing=True,
    )

async def _process_entities_batch(self):
    """Process batch of articles for entity extraction"""
    batch_size = self.config.entity_batch_size
    logger.info(f"Starting entity extraction batch (size={batch_size})")
    
    try:
        articles = self.storage.get_unprocessed_articles_for_entities(batch_size)
        
        if not articles:
            logger.debug("No articles to process for entity extraction")
            return
        
        success_count = 0
        failure_count = 0
        
        for article in articles:
            try:
                # Extract entities
                entities = self.entity_extractor.extract_entities(article)
                
                # Get existing entities for normalization
                existing_entities_query = "SELECT canonical_name FROM entities"
                existing = [
                    row[0] for row in 
                    self.storage.session.execute(existing_entities_query)
                ]
                
                for entity_data in entities:
                    # Normalize entity name
                    canonical_name = self.entity_extractor.normalize_entity(
                        entity_data["text"],
                        entity_data["type"],
                        existing
                    )
                    
                    # Get or create entity
                    entity = self.storage.get_entity_by_name(canonical_name)
                    if not entity:
                        entity = self.storage.create_entity(
                            canonical_name=canonical_name,
                            entity_type=entity_data["type"],
                        )
                    
                    # Record mention
                    self.storage.create_entity_mention(
                        entity_id=entity.id,
                        article_id=article["id"],
                        confidence=entity_data["confidence"],
                        extraction_method="ner_model",
                        context=entity_data["context"],
                    )
                
                # Mark as processed
                self.storage.mark_entities_processed(article["id"])
                success_count += 1
                
            except Exception as e:
                logger.error(f"Failed to extract entities from article {article['id']}: {e}")
                failure_count += 1
        
        logger.info(
            f"Entity extraction batch complete: "
            f"{success_count} success, {failure_count} failed"
        )
        
    except Exception as e:
        logger.error(f"Entity extraction batch failed: {e}")
```

**Acceptance**: Scheduler registers entity job

---

### T047-T052: CLI Commands for Entity Extraction (🔵 Parallel after T046)

**File**: `apps/cli/ai_web_feeds/cli/commands/nlp.py`

Add commands:
- T047: `process-entities` - Manually trigger entity extraction batch
- T048: `list-entities` - List top entities by frequency
- T049: `show-entity <name>` - Show entity details, articles, mentions
- T050: `add-alias <entity> <alias>` - Add alias to entity
- T051: `merge-entities <from> <to>` - Merge duplicate entities
- T052: `search-entities <query>` - FTS5 search entities

**Acceptance**: All entity CLI commands work

---

### T053-T060: Documentation for Entity Extraction (🔵 Parallel)

- T053: Create `apps/web/content/docs/features/entity-extraction.mdx`
- T054: Add examples, API reference
- T055: Document normalization algorithm
- T056: Document FTS5 entity search
- T057: Add troubleshooting section
- T058: Update `apps/web/content/docs/meta.json`
- T059: Test documentation builds
- T060: Review and polish

**Acceptance**: Documentation site builds, entity-extraction page renders

---

## Phase 5C: Sentiment Analysis (Tasks 061-085)

### T061: Implement SentimentAnalyzer Class (🔵)

**File**: `packages/ai_web_feeds/src/ai_web_feeds/nlp/sentiment_analyzer.py`

**Content**:
```python
"""Sentiment analysis using Hugging Face transformers"""

from transformers import pipeline
from typing import Optional, Dict
from loguru import logger
from ai_web_feeds.config import Settings


class SentimentAnalyzer:
    """Classify article sentiment using transformer models"""
    
    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or Settings()
        self.config = self.settings.phase5
        
        # Load sentiment model
        try:
            self.pipeline = pipeline(
                "sentiment-analysis",
                model=self.config.sentiment_model,
                device=-1,  # CPU only (use device=0 for GPU)
            )
            logger.info(f"Loaded sentiment model: {self.config.sentiment_model}")
        except Exception as e:
            logger.error(f"Failed to load sentiment model: {e}")
            raise
    
    def analyze_sentiment(self, article: dict) -> Dict:
        """
        Classify article sentiment
        
        Returns:
            Dict: {
                "sentiment_score": 0.75,  # -1.0 to +1.0
                "classification": "positive",  # positive/neutral/negative
                "confidence": 0.92,
                "model_name": "distilbert-base-uncased-finetuned-sst-2-english"
            }
        """
        content = article.get("content", "")
        
        if len(content) < 100:
            logger.debug(f"Article {article.get('id')} too short for sentiment analysis")
            return None
        
        # Truncate to first 512 tokens (BERT limit)
        truncated = content[:2000]
        
        # Run sentiment analysis
        result = self.pipeline(truncated)[0]
        
        # Map label to score
        label = result["label"]
        confidence = result["score"]
        
        if label == "POSITIVE":
            sentiment_score = confidence  # 0.0 to 1.0
            classification = "positive"
        elif label == "NEGATIVE":
            sentiment_score = -confidence  # 0.0 to -1.0
            classification = "negative"
        else:
            sentiment_score = 0.0
            classification = "neutral"
        
        # Apply classification thresholds
        if sentiment_score > 0.3:
            classification = "positive"
        elif sentiment_score < -0.3:
            classification = "negative"
        else:
            classification = "neutral"
        
        logger.debug(
            f"Sentiment for article {article.get('id')}: "
            f"{classification} ({sentiment_score:.2f})"
        )
        
        return {
            "sentiment_score": sentiment_score,
            "classification": classification,
            "confidence": confidence,
            "model_name": self.config.sentiment_model,
        }
```

**Acceptance**:
- `analyzer = SentimentAnalyzer()` initializes (downloads model ~67MB)
- `analyzer.analyze_sentiment(sample_article)` returns sentiment dict

---

### T062-T068: Implement SentimentAnalyzer Tests (🔵 Parallel after T061)

Tests to implement:
- T062: `test_analyze_positive_sentiment`
- T063: `test_analyze_negative_sentiment`
- T064: `test_analyze_neutral_sentiment`
- T065: `test_analyze_empty_content`
- T066: `test_sentiment_score_range` (-1.0 to +1.0)
- T067: `test_classification_thresholds`
- T068: `test_model_loading_failure`

**Acceptance**: All sentiment analyzer tests pass with ≥90% coverage

---

### T069: Create Sentiment Batch Job (🟡 After T061)

**File**: `packages/ai_web_feeds/src/ai_web_feeds/nlp_scheduler.py`

**Changes**: Add to `NLPScheduler`:

```python
def __init__(self, ...):
    # ... existing init ...
    self.sentiment_analyzer = SentimentAnalyzer(self.settings)

def register_jobs(self):
    # ... existing jobs ...
    
    # Sentiment analysis: every hour
    self.scheduler.add_job(
        self._process_sentiment_batch,
        trigger="cron",
        minute="0",
        id="nlp_sentiment_batch",
        replace_existing=True,
    )
    
    # Sentiment aggregation: every hour (after sentiment batch)
    self.scheduler.add_job(
        self._aggregate_sentiment_daily,
        trigger="cron",
        minute="15",  # Run 15 minutes after sentiment batch
        id="nlp_sentiment_aggregation",
        replace_existing=True,
    )

async def _process_sentiment_batch(self):
    """Process batch of articles for sentiment analysis"""
    batch_size = self.config.sentiment_batch_size
    logger.info(f"Starting sentiment analysis batch (size={batch_size})")
    
    try:
        articles = self.storage.get_unprocessed_articles_for_sentiment(batch_size)
        
        if not articles:
            logger.debug("No articles to process for sentiment analysis")
            return
        
        success_count = 0
        failure_count = 0
        
        for article in articles:
            try:
                # Analyze sentiment
                sentiment = self.sentiment_analyzer.analyze_sentiment(article)
                
                if sentiment:
                    # Store result
                    self.storage.add_sentiment(
                        article_id=article["id"],
                        **sentiment
                    )
                
                # Mark as processed
                self.storage.mark_sentiment_processed(article["id"])
                success_count += 1
                
            except Exception as e:
                logger.error(f"Failed to analyze sentiment for article {article['id']}: {e}")
                failure_count += 1
        
        logger.info(
            f"Sentiment analysis batch complete: "
            f"{success_count} success, {failure_count} failed"
        )
        
    except Exception as e:
        logger.error(f"Sentiment analysis batch failed: {e}")

async def _aggregate_sentiment_daily(self):
    """Aggregate sentiment by topic and date"""
    logger.info("Starting daily sentiment aggregation")
    
    try:
        # Query recent sentiment scores (last 1 hour)
        query = """
            SELECT 
                fe.topics AS topic_json,
                DATE(fe.published_at) AS date,
                asent.sentiment_score,
                asent.classification
            FROM feed_entries fe
            JOIN article_sentiment asent ON fe.id = asent.article_id
            WHERE asent.computed_at >= datetime('now', '-1 hour')
        """
        
        result = self.storage.session.execute(query)
        
        # Group by (topic, date)
        aggregates = {}
        for row in result:
            # Parse topics (stored as JSON in feed_entries)
            import json
            topics = json.loads(row[0]) if row[0] else []
            date = row[1]
            sentiment_score = row[2]
            classification = row[3]
            
            for topic in topics:
                key = (topic, date)
                if key not in aggregates:
                    aggregates[key] = {
                        "scores": [],
                        "positive": 0,
                        "neutral": 0,
                        "negative": 0,
                    }
                
                aggregates[key]["scores"].append(sentiment_score)
                aggregates[key][classification] += 1
        
        # Upsert aggregates
        for (topic, date), data in aggregates.items():
            avg_sentiment = sum(data["scores"]) / len(data["scores"])
            
            self.storage.upsert_topic_sentiment_daily(
                topic=topic,
                date=date,
                avg_sentiment=avg_sentiment,
                article_count=len(data["scores"]),
                positive_count=data["positive"],
                neutral_count=data["neutral"],
                negative_count=data["negative"],
            )
        
        logger.info(f"Aggregated sentiment for {len(aggregates)} topic-date pairs")
        
    except Exception as e:
        logger.error(f"Sentiment aggregation failed: {e}")
```

**Acceptance**: Scheduler registers sentiment + aggregation jobs

---

### T070-T075: CLI Commands for Sentiment Analysis (🔵 Parallel after T069)

**File**: `apps/cli/ai_web_feeds/cli/commands/nlp.py`

Add commands:
- T070: `process-sentiment` - Manually trigger sentiment batch
- T071: `sentiment <topic>` - Show sentiment trend for topic (30/90/365 days)
- T072: `sentiment-shifts` - Show recent sentiment shifts (>0.3 change)
- T073: `topic-sentiment-compare <topic1> <topic2>` - Compare 2 topics
- T074: `aggregate-sentiment` - Manually trigger aggregation
- T075: Add rich charts (sparklines, trend arrows)

**Acceptance**: All sentiment CLI commands work

---

### T076-T085: Documentation for Sentiment Analysis (🔵 Parallel)

- T076: Create `apps/web/content/docs/features/sentiment-analysis.mdx`
- T077: Document sentiment model (DistilBERT)
- T078: Document classification thresholds
- T079: Document aggregation algorithm
- T080: Document sentiment shift detection (7-day MA)
- T081: Add example charts (time-series, overlays)
- T082: Add math formula for moving average (KaTeX)
- T083: Update `apps/web/content/docs/meta.json`
- T084: Test documentation builds
- T085: Review and polish

**Acceptance**: Documentation site builds, sentiment-analysis page renders

---

## Phase 5D: Topic Modeling (Tasks 086-110)

### T086: Implement TopicModeler Class (🔵)

**File**: `packages/ai_web_feeds/src/ai_web_feeds/nlp/topic_modeler.py`

**Content**: Implement LDA topic modeling with Gensim (detailed implementation ~300 lines)

Key methods:
- `train_lda_model(articles, num_topics=10)` - Train LDA on corpus
- `extract_subtopics(parent_topic, articles)` - Extract subtopics for parent
- `detect_evolution(current_topics, previous_topics)` - Detect splits/merges
- `compute_coherence(model)` - Compute topic coherence score

**Acceptance**: `modeler = TopicModeler()` initializes, can train LDA

---

### T087-T095: Implement TopicModeler Tests (🔵 Parallel after T086)

Tests to implement (9 tests for topic modeling)

**Acceptance**: All topic modeler tests pass with ≥90% coverage

---

### T096: Create Topic Modeling Batch Job (🟡 After T086)

**File**: `packages/ai_web_feeds/src/ai_web_feeds/nlp_scheduler.py`

Add monthly topic modeling job (runs on 1st of month at 3 AM)

**Acceptance**: Scheduler registers topic modeling job

---

### T097-T103: CLI Commands for Topic Modeling (🔵 Parallel after T096)

Add commands:
- T097: `process-topics` - Manually trigger topic modeling
- T098: `review-subtopics` - Review unapproved subtopics
- T099: `approve-subtopic <id>` - Approve subtopic
- T100: `rename-subtopic <id> <name>` - Rename subtopic
- T101: `list-subtopics <parent>` - List subtopics for parent
- T102: `topic-evolution` - Show evolution events
- T103: Add interactive approval workflow

**Acceptance**: All topic modeling CLI commands work

---

### T104-T110: Documentation for Topic Modeling (🔵 Parallel)

- T104: Create `apps/web/content/docs/features/topic-modeling.mdx`
- T105: Document LDA algorithm
- T106: Document topic coherence metric
- T107: Document evolution detection
- T108: Document manual curation workflow
- T109: Update `apps/web/content/docs/meta.json`
- T110: Test documentation builds

**Acceptance**: Documentation site builds, topic-modeling page renders

---

## Phase 5E: Testing & Documentation (Tasks 111-127)

### T111-T115: Integration Tests (🔵 Parallel)

- T111: `test_quality_batch_end_to_end` - Process 100 articles
- T112: `test_entity_batch_end_to_end` - Extract entities from 50 articles
- T113: `test_sentiment_batch_end_to_end` - Analyze + aggregate 100 articles
- T114: `test_topic_modeling_end_to_end` - Model 1000 articles
- T115: `test_all_nlp_jobs_run` - Scheduler runs all jobs without errors

**Acceptance**: All integration tests pass

---

### T116-T120: Performance Benchmarks (🔵 Parallel)

- T116: Benchmark quality scoring (100 articles)
- T117: Benchmark entity extraction (50 articles)
- T118: Benchmark sentiment analysis (100 articles)
- T119: Benchmark topic modeling (1000 articles)
- T120: Verify throughput: ≥100 articles/hour for quality scoring

**Acceptance**: All benchmarks meet performance targets

---

### T121: CLI Validation (🟡 After all CLI tasks)

**Test all CLI commands**:
```bash
aiwebfeeds nlp --help
aiwebfeeds nlp process-quality --batch-size 10
aiwebfeeds nlp stats
aiwebfeeds nlp list-entities --limit 10
aiwebfeeds nlp sentiment "AI Safety" --days 30
aiwebfeeds nlp review-subtopics
```

**Acceptance**: All CLI commands work without errors

---

### T122: Coverage Report (🟡 After all tests)

**Run**:
```bash
cd tests
uv run pytest --cov=ai_web_feeds --cov-report=html --cov-report=term
```

**Acceptance**: Coverage ≥90% for all `nlp/` modules

---

### T123: Update Root Documentation (🔵 Parallel)

- Update `README.md`: Add Phase 5 features section
- Update `CHANGELOG.md`: Add Phase 5 changes
- Create `RELEASE_NOTES.md` for v0.4.0-beta

**Acceptance**: Root docs updated

---

### T124: Update Web Documentation (🔵 Parallel)

- Update `apps/web/content/docs/index.mdx`: Add Phase 5 overview
- Ensure all 4 feature docs are linked correctly
- Test navigation

**Acceptance**: Web docs site builds, navigation works

---

### T125: Final Testing (🟡 After T121-T124)

**Full test suite**:
```bash
uv run pytest
cd apps/web && pnpm build
cd apps/cli && aiwebfeeds --help
```

**Acceptance**: All tests pass, builds succeed, CLI works

---

### T126: Commit & Tag (🟡 After T125)

**Git operations**:
```bash
git add .
git commit -m "feat(phase5): complete advanced AI/NLP features

- Quality scoring with heuristic analysis
- Entity extraction with spaCy NER
- Sentiment analysis with DistilBERT
- Topic modeling with Gensim LDA
- 8 new SQLite tables for NLP results
- CLI commands for all NLP operations
- Comprehensive documentation

BREAKING CHANGE: Requires spaCy model download (13MB)
"

git tag v0.4.0-beta -m "Phase 5: Advanced AI/NLP Features"
```

**Acceptance**: Commit created, tag added

---

### T127: Merge to Main (🟡 After T126)

**Git operations**:
```bash
git checkout main
git merge 005-advanced-ai-nlp --no-ff
git push origin main
git push origin v0.4.0-beta
```

**Acceptance**: Merged to main, pushed to remote

---

## Summary

**Total Tasks**: 127  
**Phases**: 5 (5A-5E)  
**Estimated Timeline**: 5 weeks  
**Dependencies**: Phase 3B (feed_entries table, APScheduler)

**Parallelization Opportunities**:
- Setup tasks (T001-T015): All parallel
- Quality scoring tests (T017-T022): All parallel after T016
- Entity extraction tests (T038-T045): All parallel after T037
- Sentiment analysis tests (T062-T068): All parallel after T061
- Documentation tasks: All parallel within each phase

**Critical Path**:
T001-T007 → T016 → T023 → T024 → T037 → T046 → T061 → T069 → T086 → T096 → T125 → T126 → T127

**Status**: ✅ Ready for Implementation


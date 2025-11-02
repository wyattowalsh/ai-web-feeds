"""Performance benchmarks for critical operations.

These tests measure performance and ensure operations meet SLA requirements.
"""

import pytest
import time
import numpy as np
from sqlmodel import Session, SQLModel, create_engine, select

from ai_web_feeds.models import FeedSource, FeedEmbedding
from ai_web_feeds.search import build_trie_index, full_text_search, autocomplete
from ai_web_feeds.analytics import calculate_summary_metrics, calculate_trending_topics


@pytest.fixture
def perf_db():
    """Create database with performance test data."""
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    
    with Session(engine) as session:
        # Create 1000 test feeds
        for i in range(1000):
            feed = FeedSource(
                id=f"feed{i}",
                title=f"Test Feed {i}",
                topics=["llm", "research"] if i % 2 == 0 else ["training", "cv"],
                verified=i % 3 == 0,
                popularity_score=0.5 + (i % 10) / 20,
                validation_count=i % 100,
            )
            session.add(feed)
        session.commit()
    
    return engine


class TestSearchPerformance:
    """Performance tests for search operations."""
    
    @pytest.mark.benchmark
    def test_trie_build_performance(self, perf_db):
        """Test Trie index build time for 1000 feeds."""
        with Session(perf_db) as session:
            start = time.time()
            trie = build_trie_index(session)
            duration = time.time() - start
            
            # Should build index in < 1 second
            assert duration < 1.0, f"Trie build took {duration:.3f}s, expected < 1.0s"
            print(f"\n✓ Trie build: {duration:.3f}s for 1000 feeds")
    
    @pytest.mark.benchmark
    def test_autocomplete_performance(self, perf_db):
        """Test autocomplete response time."""
        with Session(perf_db) as session:
            build_trie_index(session)
            
            # Measure multiple autocomplete calls
            durations = []
            for prefix in ["test", "feed", "res", "tra"]:
                start = time.time()
                results = autocomplete(session, prefix, limit=8)
                duration = time.time() - start
                durations.append(duration)
            
            avg_duration = np.mean(durations)
            
            # Should respond in < 200ms
            assert avg_duration < 0.2, f"Autocomplete took {avg_duration:.3f}s, expected < 0.2s"
            print(f"\n✓ Autocomplete avg: {avg_duration:.3f}s (n={len(durations)})")
    
    @pytest.mark.benchmark
    @pytest.mark.skip(reason="FTS5 may not be available in test environment")
    def test_full_text_search_performance(self, perf_db):
        """Test full-text search performance."""
        with Session(perf_db) as session:
            try:
                # This may fail without FTS5
                from ai_web_feeds.search import create_fts_table
                create_fts_table(session)
                
                start = time.time()
                results = full_text_search(session, "test feed", limit=20)
                duration = time.time() - start
                
                # Should search in < 500ms
                assert duration < 0.5, f"FTS took {duration:.3f}s, expected < 0.5s"
                print(f"\n✓ Full-text search: {duration:.3f}s for 1000 feeds")
            except Exception as e:
                pytest.skip(f"FTS5 not available: {e}")


class TestAnalyticsPerformance:
    """Performance tests for analytics operations."""
    
    @pytest.mark.benchmark
    def test_summary_metrics_performance(self, perf_db):
        """Test summary metrics calculation time."""
        with Session(perf_db) as session:
            start = time.time()
            metrics = calculate_summary_metrics(session, date_range_days=30)
            duration = time.time() - start
            
            # Should calculate in < 1 second
            assert duration < 1.0, f"Summary metrics took {duration:.3f}s, expected < 1.0s"
            print(f"\n✓ Summary metrics: {duration:.3f}s for 1000 feeds")
    
    @pytest.mark.benchmark
    def test_trending_topics_performance(self, perf_db):
        """Test trending topics calculation time."""
        with Session(perf_db) as session:
            start = time.time()
            trending = calculate_trending_topics(session, date_range_days=30, limit=10)
            duration = time.time() - start
            
            # Should calculate in < 2 seconds
            assert duration < 2.0, f"Trending topics took {duration:.3f}s, expected < 2.0s"
            print(f"\n✓ Trending topics: {duration:.3f}s for 1000 feeds")


class TestEmbeddingPerformance:
    """Performance tests for embedding operations."""
    
    @pytest.mark.benchmark
    @pytest.mark.slow
    def test_embedding_generation_performance(self):
        """Test embedding generation speed."""
        try:
            from ai_web_feeds.embeddings import generate_embeddings_local
            
            # Generate embeddings for 10 texts
            texts = [f"Test text number {i}" for i in range(10)]
            
            start = time.time()
            embeddings = generate_embeddings_local(texts, show_progress=False)
            duration = time.time() - start
            
            # Should generate in < 5 seconds for 10 texts
            assert duration < 5.0, f"Embedding generation took {duration:.3f}s, expected < 5.0s"
            print(f"\n✓ Embedding generation: {duration:.3f}s for 10 texts ({duration/10:.3f}s per text)")
        except ImportError:
            pytest.skip("Sentence-transformers not available")


class TestDatabasePerformance:
    """Performance tests for database operations."""
    
    @pytest.mark.benchmark
    def test_feed_query_performance(self, perf_db):
        """Test feed query performance."""
        with Session(perf_db) as session:
            # Test simple select
            start = time.time()
            feeds = list(session.exec(select(FeedSource).limit(100)).all())
            duration = time.time() - start
            
            assert duration < 0.1, f"Query took {duration:.3f}s, expected < 0.1s"
            print(f"\n✓ Feed query (100 rows): {duration:.3f}s")
    
    @pytest.mark.benchmark
    def test_filtered_query_performance(self, perf_db):
        """Test filtered query performance."""
        with Session(perf_db) as session:
            # Test filtered select
            start = time.time()
            feeds = list(session.exec(
                select(FeedSource)
                .where(FeedSource.verified == True)
                .where(FeedSource.topics.contains(["llm"]))
                .limit(50)
            ).all())
            duration = time.time() - start
            
            assert duration < 0.2, f"Filtered query took {duration:.3f}s, expected < 0.2s"
            print(f"\n✓ Filtered query (50 rows): {duration:.3f}s")


# Performance summary
@pytest.fixture(scope="session", autouse=True)
def performance_summary(request):
    """Print performance summary after tests."""
    yield
    
    print("\n" + "="*70)
    print("PERFORMANCE BENCHMARK SUMMARY")
    print("="*70)
    print("\nTarget SLAs:")
    print("  - Trie build: < 1.0s for 1000 feeds")
    print("  - Autocomplete: < 200ms")
    print("  - Full-text search: < 500ms")
    print("  - Summary metrics: < 1.0s")
    print("  - Trending topics: < 2.0s")
    print("  - Embedding generation: < 500ms per text")
    print("  - Database queries: < 100ms for simple, < 200ms for complex")
    print("\n" + "="*70)


# Configuration
def pytest_configure(config):
    """Configure pytest markers."""
    config.addinivalue_line("markers", "benchmark: mark test as performance benchmark")
    config.addinivalue_line("markers", "slow: mark test as slow running")


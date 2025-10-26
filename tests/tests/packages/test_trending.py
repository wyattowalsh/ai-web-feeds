"""Unit tests for ai_web_feeds.trending module"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from ai_web_feeds.config import Settings
from ai_web_feeds.models import FeedEntry, TrendingTopic
from ai_web_feeds.trending import TrendingDetector
from ai_web_feeds.storage import DatabaseManager


@pytest.fixture
def mock_db():
    """Mock database manager"""
    db = MagicMock(spec=DatabaseManager)
    db.get_session = MagicMock()
    db.save_trending_topics = MagicMock()
    return db


@pytest.fixture
def mock_settings():
    """Mock settings"""
    settings = Settings()
    settings.phase3b.trending_baseline_days = 3
    settings.phase3b.trending_z_score_threshold = 2.0
    settings.phase3b.trending_min_articles = 5
    settings.phase3b.trending_update_interval_hours = 1
    return settings


@pytest.fixture
def detector(mock_db, mock_settings):
    """Create TrendingDetector instance"""
    return TrendingDetector(mock_db, mock_settings)


@pytest.fixture
def sample_entries():
    """Sample feed entries with categories"""
    base_time = datetime.utcnow()
    entries = []
    
    # Create entries with different categories
    categories_list = [
        ["AI", "Machine Learning"],
        ["AI", "GPT"],
        ["AI"],
        ["Blockchain"],
        ["AI", "Ethics"],
    ]
    
    for i, categories in enumerate(categories_list):
        entry = FeedEntry(
            id=i + 1,
            feed_id="test-feed",
            guid=f"article-{i+1}",
            link=f"http://example.com/article-{i+1}",
            title=f"Article {i+1}",
            summary=f"Summary {i+1}",
            pub_date=base_time - timedelta(minutes=i*10),
            discovered_at=base_time - timedelta(minutes=i*10),
            categories=categories,
        )
        entries.append(entry)
    
    return entries


class TestTrendingDetector:
    """Test TrendingDetector class"""

    def test_initialization(self, detector, mock_db, mock_settings):
        """Test detector initialization"""
        assert detector.db == mock_db
        assert detector.settings == mock_settings
        assert detector.baseline_days == 3
        assert detector.z_threshold == 2.0
        assert detector.min_articles == 5

    @pytest.mark.asyncio
    async def test_get_topic_counts(self, detector, sample_entries):
        """Test topic counting"""
        # Mock session and query
        mock_session = MagicMock()
        mock_session.exec = MagicMock(return_value=MagicMock(all=lambda: sample_entries))
        mock_session.__enter__ = MagicMock(return_value=mock_session)
        mock_session.__exit__ = MagicMock(return_value=False)
        
        detector.db.get_session = MagicMock(return_value=mock_session)
        
        now = datetime.utcnow()
        start = now - timedelta(hours=1)
        
        counts = await detector._get_topic_counts(start, now)
        
        # Verify counts
        assert counts["AI"] == 4  # 4 entries have "AI" category
        assert counts["Machine Learning"] == 1
        assert counts["GPT"] == 1
        assert counts["Blockchain"] == 1
        assert counts["Ethics"] == 1

    @pytest.mark.asyncio
    async def test_get_baseline_stats(self, detector):
        """Test baseline statistics calculation"""
        # Create entries spread over 3 days
        now = datetime.utcnow()
        entries = []
        
        # Day 1: 10 AI articles
        for i in range(10):
            entry = FeedEntry(
                id=i + 1,
                feed_id="test-feed",
                guid=f"d1-article-{i}",
                link=f"http://example.com/d1-{i}",
                title=f"Day 1 Article {i}",
                pub_date=now - timedelta(days=2, hours=i),
                discovered_at=now - timedelta(days=2, hours=i),
                categories=["AI"],
            )
            entries.append(entry)
        
        # Day 2: 12 AI articles
        for i in range(12):
            entry = FeedEntry(
                id=i + 11,
                feed_id="test-feed",
                guid=f"d2-article-{i}",
                link=f"http://example.com/d2-{i}",
                title=f"Day 2 Article {i}",
                pub_date=now - timedelta(days=1, hours=i),
                discovered_at=now - timedelta(days=1, hours=i),
                categories=["AI"],
            )
            entries.append(entry)
        
        # Day 3: 8 AI articles
        for i in range(8):
            entry = FeedEntry(
                id=i + 23,
                feed_id="test-feed",
                guid=f"d3-article-{i}",
                link=f"http://example.com/d3-{i}",
                title=f"Day 3 Article {i}",
                pub_date=now - timedelta(hours=i),
                discovered_at=now - timedelta(hours=i),
                categories=["AI"],
            )
            entries.append(entry)
        
        # Mock session
        mock_session = MagicMock()
        mock_session.exec = MagicMock(return_value=MagicMock(all=lambda: entries))
        mock_session.__enter__ = MagicMock(return_value=mock_session)
        mock_session.__exit__ = MagicMock(return_value=False)
        
        detector.db.get_session = MagicMock(return_value=mock_session)
        
        start = now - timedelta(days=3)
        stats = await detector._get_baseline_stats(start, now)
        
        # Verify stats for "AI" category
        assert "AI" in stats
        mean, std_dev = stats["AI"]
        assert mean == pytest.approx(10.0, rel=0.1)  # Mean of [10, 12, 8]
        assert std_dev > 0  # Should have variance

    @pytest.mark.asyncio
    async def test_get_representative_articles(self, detector, sample_entries):
        """Test representative article selection"""
        # Mock session
        mock_session = MagicMock()
        mock_session.exec = MagicMock(return_value=MagicMock(all=lambda: [1, 2, 3, 4, 5]))
        mock_session.get = MagicMock(side_effect=lambda model, id: sample_entries[id-1])
        mock_session.__enter__ = MagicMock(return_value=mock_session)
        mock_session.__exit__ = MagicMock(return_value=False)
        
        detector.db.get_session = MagicMock(return_value=mock_session)
        
        now = datetime.utcnow()
        start = now - timedelta(hours=1)
        
        article_ids = await detector._get_representative_articles("AI", start, now, limit=3)
        
        # Should return up to 3 article IDs with "AI" category
        assert len(article_ids) <= 3
        assert len(article_ids) > 0

    @pytest.mark.asyncio
    async def test_detect_trending_topics_with_spike(self, detector):
        """Test trending detection with significant spike"""
        # Mock _get_topic_counts to return high current count
        async def mock_current_counts(*args):
            return {"AI": 50}  # High current count
        
        # Mock _get_baseline_stats to return low baseline
        async def mock_baseline_stats(*args):
            return {"AI": (10.0, 2.0)}  # Mean=10, StdDev=2
        
        # Mock _get_representative_articles
        async def mock_articles(*args, **kwargs):
            return [1, 2, 3]
        
        with patch.object(detector, "_get_topic_counts", side_effect=mock_current_counts):
            with patch.object(detector, "_get_baseline_stats", side_effect=mock_baseline_stats):
                with patch.object(detector, "_get_representative_articles", side_effect=mock_articles):
                    trending = await detector.detect_trending_topics()
        
        # Should detect "AI" as trending
        assert len(trending) == 1
        assert trending[0].topic_id == "AI"
        assert trending[0].z_score == pytest.approx((50 - 10.0) / 2.0)  # Z-score = (50-10)/2 = 20
        assert trending[0].article_count == 50
        assert trending[0].rank == 1

    @pytest.mark.asyncio
    async def test_detect_trending_topics_no_spike(self, detector):
        """Test trending detection with no significant spike"""
        # Mock _get_topic_counts to return normal count
        async def mock_current_counts(*args):
            return {"AI": 12}  # Normal count
        
        # Mock _get_baseline_stats
        async def mock_baseline_stats(*args):
            return {"AI": (10.0, 5.0)}  # Mean=10, StdDev=5
        
        with patch.object(detector, "_get_topic_counts", side_effect=mock_current_counts):
            with patch.object(detector, "_get_baseline_stats", side_effect=mock_baseline_stats):
                trending = await detector.detect_trending_topics()
        
        # Should not detect trending (z-score = (12-10)/5 = 0.4 < threshold)
        assert len(trending) == 0

    @pytest.mark.asyncio
    async def test_detect_trending_topics_min_articles_filter(self, detector):
        """Test minimum articles threshold"""
        # Mock _get_topic_counts to return count below minimum
        async def mock_current_counts(*args):
            return {"AI": 3}  # Below min_articles (5)
        
        # Mock _get_baseline_stats
        async def mock_baseline_stats(*args):
            return {"AI": (1.0, 0.5)}  # Would have high z-score but low count
        
        with patch.object(detector, "_get_topic_counts", side_effect=mock_current_counts):
            with patch.object(detector, "_get_baseline_stats", side_effect=mock_baseline_stats):
                trending = await detector.detect_trending_topics()
        
        # Should not detect due to min_articles filter
        assert len(trending) == 0

    @pytest.mark.asyncio
    async def test_detect_trending_topics_no_baseline(self, detector):
        """Test trending detection when no baseline exists"""
        # Mock _get_topic_counts
        async def mock_current_counts(*args):
            return {"NewTopic": 50}
        
        # Mock _get_baseline_stats with no data for NewTopic
        async def mock_baseline_stats(*args):
            return {}  # No baseline
        
        with patch.object(detector, "_get_topic_counts", side_effect=mock_current_counts):
            with patch.object(detector, "_get_baseline_stats", side_effect=mock_baseline_stats):
                trending = await detector.detect_trending_topics()
        
        # Should not detect without baseline
        assert len(trending) == 0

    @pytest.mark.asyncio
    async def test_detect_trending_topics_zero_std(self, detector):
        """Test trending detection with zero standard deviation"""
        # Mock _get_topic_counts
        async def mock_current_counts(*args):
            return {"AI": 50}
        
        # Mock _get_baseline_stats with zero std dev
        async def mock_baseline_stats(*args):
            return {"AI": (10.0, 0.0)}  # StdDev=0
        
        with patch.object(detector, "_get_topic_counts", side_effect=mock_current_counts):
            with patch.object(detector, "_get_baseline_stats", side_effect=mock_baseline_stats):
                trending = await detector.detect_trending_topics()
        
        # Should skip due to zero variance
        assert len(trending) == 0

    @pytest.mark.asyncio
    async def test_detect_trending_topics_ranking(self, detector):
        """Test trending topics are ranked by z-score"""
        # Mock _get_topic_counts
        async def mock_current_counts(*args):
            return {
                "AI": 50,
                "Blockchain": 30,
                "IoT": 40,
            }
        
        # Mock _get_baseline_stats
        async def mock_baseline_stats(*args):
            return {
                "AI": (10.0, 2.0),         # Z-score = (50-10)/2 = 20
                "Blockchain": (15.0, 3.0), # Z-score = (30-15)/3 = 5
                "IoT": (8.0, 1.0),         # Z-score = (40-8)/1 = 32
            }
        
        # Mock _get_representative_articles
        async def mock_articles(*args, **kwargs):
            return [1, 2, 3]
        
        with patch.object(detector, "_get_topic_counts", side_effect=mock_current_counts):
            with patch.object(detector, "_get_baseline_stats", side_effect=mock_baseline_stats):
                with patch.object(detector, "_get_representative_articles", side_effect=mock_articles):
                    trending = await detector.detect_trending_topics()
        
        # Should be ranked by z-score: IoT (32) > AI (20) > Blockchain (5)
        assert len(trending) == 3
        assert trending[0].topic_id == "IoT"
        assert trending[0].rank == 1
        assert trending[1].topic_id == "AI"
        assert trending[1].rank == 2
        assert trending[2].topic_id == "Blockchain"
        assert trending[2].rank == 3


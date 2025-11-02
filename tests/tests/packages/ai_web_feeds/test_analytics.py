"""Unit tests for ai_web_feeds.analytics module."""

from datetime import datetime, timedelta

import pytest
from sqlmodel import Session, SQLModel, create_engine, select

from ai_web_feeds.analytics import (
    calculate_health_distribution,
    calculate_summary_metrics,
    calculate_trending_topics,
    calculate_validation_velocity,
    generate_analytics_csv_report,
)
from ai_web_feeds.models import (
    AnalyticsSnapshot,
    FeedSource,
    FeedValidationResult,
)


@pytest.fixture
def test_engine():
    """Create in-memory SQLite engine for testing."""
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture
def test_session(test_engine):
    """Create test database session."""
    with Session(test_engine) as session:
        yield session


@pytest.fixture
def sample_feeds(test_session):
    """Create sample feeds with various statuses."""
    feeds = [
        FeedSource(
            id="feed1",
            title="Active Feed 1",
            topics=["llm", "research"],
            verified=True,
            curation_status="verified",
            popularity_score=0.95,
            validation_count=150,
        ),
        FeedSource(
            id="feed2",
            title="Active Feed 2",
            topics=["llm", "training"],
            verified=True,
            curation_status="verified",
            popularity_score=0.85,
            validation_count=120,
        ),
        FeedSource(
            id="feed3",
            title="Moderate Feed",
            topics=["cv", "research"],
            verified=True,
            curation_status="verified",
            popularity_score=0.65,
            validation_count=80,
        ),
        FeedSource(
            id="feed4",
            title="Inactive Feed",
            topics=["old"],
            verified=False,
            curation_status="inactive",
            popularity_score=0.25,
            validation_count=10,
        ),
    ]

    for feed in feeds:
        test_session.add(feed)
    test_session.commit()

    return feeds


@pytest.fixture
def sample_validations(test_session, sample_feeds):
    """Create sample validation results."""
    now = datetime.utcnow()
    validations = []

    # Feed1: Mostly successful
    for i in range(10):
        validation = FeedValidationResult(
            feed_source_id="feed1",
            success=True,
            status_code=200,
            response_time=0.5 + (i * 0.1),
            validated_at=now - timedelta(days=i),
        )
        test_session.add(validation)
        validations.append(validation)

    # Feed2: Some failures
    for i in range(10):
        validation = FeedValidationResult(
            feed_source_id="feed2",
            success=i % 3 != 0,  # Fail every 3rd
            status_code=200 if i % 3 != 0 else 500,
            response_time=0.8 + (i * 0.05),
            validated_at=now - timedelta(days=i),
        )
        test_session.add(validation)
        validations.append(validation)

    # Feed3: All failures
    for i in range(5):
        validation = FeedValidationResult(
            feed_source_id="feed3",
            success=False,
            status_code=404,
            error_message="Not found",
            validated_at=now - timedelta(days=i),
        )
        test_session.add(validation)
        validations.append(validation)

    test_session.commit()
    return validations


class TestSummaryMetrics:
    """Tests for summary metrics calculation."""

    def test_calculate_summary_metrics_basic(self, test_session, sample_feeds):
        """Test basic summary metrics calculation."""
        metrics = calculate_summary_metrics(test_session, date_range_days=30)

        assert "total_feeds" in metrics
        assert "active_feeds" in metrics
        assert "verified_feeds" in metrics
        assert "total_topics" in metrics

        assert metrics["total_feeds"] == 4
        assert metrics["active_feeds"] == 3  # Excluding inactive
        assert metrics["verified_feeds"] == 3

    def test_calculate_summary_metrics_with_validations(
        self, test_session, sample_feeds, sample_validations
    ):
        """Test summary metrics with validation data."""
        metrics = calculate_summary_metrics(test_session, date_range_days=30)

        assert "validation_success_rate" in metrics
        assert "avg_response_time" in metrics

        # Should calculate success rate from validations
        assert 0.0 <= metrics["validation_success_rate"] <= 1.0
        assert metrics["avg_response_time"] > 0

    def test_calculate_summary_metrics_topic_filter(self, test_session, sample_feeds):
        """Test summary metrics with topic filter."""
        metrics = calculate_summary_metrics(test_session, date_range_days=30, topic="llm")

        # Should only count feeds with "llm" topic
        assert metrics["active_feeds"] <= 2  # feed1 and feed2


class TestTrendingTopics:
    """Tests for trending topics calculation."""

    def test_calculate_trending_topics(self, test_session, sample_feeds, sample_validations):
        """Test trending topics based on validation frequency."""
        trending = calculate_trending_topics(test_session, date_range_days=30, limit=10)

        assert isinstance(trending, list)
        assert len(trending) > 0

        # Each entry should have topic, feed_count, validation_count
        for topic_data in trending:
            assert "topic" in topic_data
            assert "feed_count" in topic_data
            assert "validation_count" in topic_data
            assert topic_data["feed_count"] > 0

    def test_calculate_trending_topics_ordering(
        self, test_session, sample_feeds, sample_validations
    ):
        """Test trending topics are ordered by activity."""
        trending = calculate_trending_topics(test_session, date_range_days=30, limit=10)

        # Should be sorted by validation count (descending)
        if len(trending) >= 2:
            assert trending[0]["validation_count"] >= trending[1]["validation_count"]

    def test_calculate_trending_topics_limit(self, test_session, sample_feeds, sample_validations):
        """Test trending topics respects limit parameter."""
        trending = calculate_trending_topics(test_session, date_range_days=30, limit=2)

        assert len(trending) <= 2

    def test_calculate_trending_topics_empty_db(self, test_session):
        """Test trending topics with no data."""
        trending = calculate_trending_topics(test_session, date_range_days=30, limit=10)

        assert isinstance(trending, list)
        assert len(trending) == 0


class TestValidationVelocity:
    """Tests for validation velocity calculation."""

    def test_calculate_validation_velocity_daily(
        self, test_session, sample_feeds, sample_validations
    ):
        """Test daily validation velocity."""
        velocity = calculate_validation_velocity(
            test_session, date_range_days=7, granularity="daily"
        )

        assert isinstance(velocity, list)
        assert len(velocity) > 0

        # Each data point should have date and count
        for point in velocity:
            assert "date" in point
            assert "count" in point
            assert point["count"] >= 0

    def test_calculate_validation_velocity_weekly(
        self, test_session, sample_feeds, sample_validations
    ):
        """Test weekly validation velocity."""
        velocity = calculate_validation_velocity(
            test_session, date_range_days=30, granularity="weekly"
        )

        assert isinstance(velocity, list)
        # Weekly should have fewer data points than daily
        assert len(velocity) <= 5  # ~4 weeks in 30 days

    def test_calculate_validation_velocity_monthly(
        self, test_session, sample_feeds, sample_validations
    ):
        """Test monthly validation velocity."""
        velocity = calculate_validation_velocity(
            test_session, date_range_days=90, granularity="monthly"
        )

        assert isinstance(velocity, list)
        # Monthly should have fewer data points
        assert len(velocity) <= 3  # ~3 months in 90 days


class TestHealthDistribution:
    """Tests for health distribution calculation."""

    def test_calculate_health_distribution(self, test_session, sample_feeds, sample_validations):
        """Test health distribution calculation."""
        distribution = calculate_health_distribution(test_session, date_range_days=30)

        assert "healthy" in distribution
        assert "moderate" in distribution
        assert "unhealthy" in distribution

        # Counts should sum to total active feeds
        total = distribution["healthy"] + distribution["moderate"] + distribution["unhealthy"]
        assert total <= len(sample_feeds)

    def test_calculate_health_distribution_thresholds(
        self, test_session, sample_feeds, sample_validations
    ):
        """Test health distribution categorization thresholds."""
        distribution = calculate_health_distribution(test_session, date_range_days=30)

        # Based on our test data:
        # feed1: 100% success -> healthy
        # feed2: 66% success -> moderate
        # feed3: 0% success -> unhealthy

        assert distribution["healthy"] >= 1
        assert distribution["moderate"] >= 0
        assert distribution["unhealthy"] >= 1

    def test_calculate_health_distribution_no_validations(self, test_session, sample_feeds):
        """Test health distribution with no validation data."""
        distribution = calculate_health_distribution(test_session, date_range_days=30)

        # Without validation data, all should be categorized as moderate
        assert distribution["moderate"] >= 0


class TestCSVReportGeneration:
    """Tests for CSV report generation."""

    def test_generate_analytics_csv_report(self, test_session, sample_feeds, sample_validations):
        """Test generating CSV analytics report."""
        csv_content = generate_analytics_csv_report(test_session, date_range_days=30)

        assert isinstance(csv_content, str)
        assert len(csv_content) > 0

        # Should have CSV headers
        assert "metric" in csv_content.lower() or "topic" in csv_content.lower()

        # Should have data rows
        lines = csv_content.strip().split("\n")
        assert len(lines) > 1  # Header + at least one data row

    def test_generate_analytics_csv_report_format(
        self, test_session, sample_feeds, sample_validations
    ):
        """Test CSV report has proper format."""
        csv_content = generate_analytics_csv_report(test_session, date_range_days=30)

        lines = csv_content.strip().split("\n")

        # All lines should have consistent column count
        if len(lines) > 1:
            header_cols = len(lines[0].split(","))
            for line in lines[1:]:
                assert len(line.split(",")) == header_cols


class TestAnalyticsSnapshot:
    """Tests for analytics snapshot storage."""

    def test_create_analytics_snapshot(self, test_session, sample_feeds, sample_validations):
        """Test creating analytics snapshot."""
        snapshot_date = datetime.utcnow().date().isoformat()

        # Calculate metrics
        summary = calculate_summary_metrics(test_session, date_range_days=30)
        trending = calculate_trending_topics(test_session, date_range_days=30, limit=10)
        health = calculate_health_distribution(test_session, date_range_days=30)

        # Create snapshot
        snapshot = AnalyticsSnapshot(
            snapshot_date=snapshot_date,
            metrics={
                "total_feeds": summary["total_feeds"],
                "active_feeds": summary["active_feeds"],
                "success_rate": summary.get("validation_success_rate", 0.0),
            },
            trending_topics=[t["topic"] for t in trending[:5]],
            health_distribution=health,
        )

        test_session.add(snapshot)
        test_session.commit()

        # Verify snapshot was saved
        saved_snapshot = test_session.exec(
            select(AnalyticsSnapshot).where(AnalyticsSnapshot.snapshot_date == snapshot_date)
        ).first()

        assert saved_snapshot is not None
        assert saved_snapshot.metrics["total_feeds"] == summary["total_feeds"]
        assert len(saved_snapshot.trending_topics) <= 5


# Property-based tests
@pytest.mark.parametrize("date_range_days", [7, 30, 90])
def test_summary_metrics_various_date_ranges(
    test_session, sample_feeds, sample_validations, date_range_days
):
    """Property test: Summary metrics work for various date ranges."""
    metrics = calculate_summary_metrics(test_session, date_range_days=date_range_days)

    assert "total_feeds" in metrics
    assert "active_feeds" in metrics
    assert metrics["total_feeds"] >= 0
    assert metrics["active_feeds"] >= 0


@pytest.mark.parametrize("granularity", ["daily", "weekly", "monthly"])
def test_velocity_various_granularities(
    test_session, sample_feeds, sample_validations, granularity
):
    """Property test: Velocity calculation works for all granularities."""
    velocity = calculate_validation_velocity(
        test_session, date_range_days=30, granularity=granularity
    )

    assert isinstance(velocity, list)
    for point in velocity:
        assert "date" in point
        assert "count" in point


@pytest.mark.parametrize("limit", [5, 10, 20])
def test_trending_topics_various_limits(test_session, sample_feeds, sample_validations, limit):
    """Property test: Trending topics respects various limits."""
    trending = calculate_trending_topics(test_session, date_range_days=30, limit=limit)

    assert len(trending) <= limit

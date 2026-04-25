"""Tests for analytics calculations against the current data model."""

from datetime import UTC, datetime, timedelta

import pytest
from ai_web_feeds.analytics import (
    calculate_health_distribution,
    calculate_summary_metrics,
    calculate_trending_topics,
    calculate_validation_velocity,
    generate_analytics_csv_report,
    generate_analytics_snapshot,
)
from ai_web_feeds.models import AnalyticsSnapshot, FeedSource, FeedValidationResult
from sqlmodel import Session, SQLModel, create_engine, select


@pytest.fixture
def test_engine():
    """Create an in-memory SQLite engine for testing."""
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
    """Create sample feeds with varying quality profiles."""
    feeds = [
        FeedSource(
            id="feed1",
            title="Active Feed 1",
            topics=["llm", "research"],
            verified=True,
            curation_status="verified",
            popularity_score=0.95,
            quality_score=0.92,
            validation_count=150,
        ),
        FeedSource(
            id="feed2",
            title="Active Feed 2",
            topics=["llm", "training"],
            verified=True,
            curation_status="verified",
            popularity_score=0.85,
            quality_score=0.62,
            validation_count=120,
        ),
        FeedSource(
            id="feed3",
            title="Moderate Feed",
            topics=["cv", "research"],
            verified=True,
            curation_status="verified",
            popularity_score=0.65,
            quality_score=0.35,
            validation_count=80,
        ),
        FeedSource(
            id="feed4",
            title="Inactive Feed",
            topics=["old"],
            verified=False,
            curation_status="inactive",
            popularity_score=0.25,
            quality_score=0.55,
            validation_count=10,
        ),
    ]

    for feed in feeds:
        test_session.add(feed)
    test_session.commit()

    return feeds


@pytest.fixture
def sample_validations(test_session, sample_feeds):
    """Create sample validation results using the current validation schema."""
    now = datetime.now(UTC)
    validations = []

    for i in range(10):
        validation = FeedValidationResult(
            feed_source_id="feed1",
            is_valid=True,
            is_accessible=True,
            format_valid=True,
            has_items=True,
            item_count=20,
            http_status=200,
            response_time_ms=500 + (i * 25),
            validated_at=now - timedelta(days=i),
        )
        test_session.add(validation)
        validations.append(validation)

    for i in range(10):
        validation = FeedValidationResult(
            feed_source_id="feed2",
            is_valid=i % 3 != 0,
            is_accessible=True,
            format_valid=i % 3 != 0,
            has_items=i % 3 != 0,
            item_count=12,
            http_status=200 if i % 3 != 0 else 500,
            response_time_ms=800 + (i * 20),
            warnings=["temporary issue"] if i % 3 == 0 else [],
            validated_at=now - timedelta(days=i),
        )
        test_session.add(validation)
        validations.append(validation)

    for i in range(5):
        validation = FeedValidationResult(
            feed_source_id="feed3",
            is_valid=False,
            is_accessible=False,
            format_valid=False,
            has_items=False,
            http_status=404,
            response_time_ms=0,
            warnings=["not found"],
            validated_at=now - timedelta(days=i),
        )
        test_session.add(validation)
        validations.append(validation)

    test_session.commit()
    return validations


class TestSummaryMetrics:
    """Tests for summary metrics calculation."""

    def test_calculate_summary_metrics_basic(self, test_session, sample_feeds):
        """Summary metrics should expose key feed counts."""
        metrics = calculate_summary_metrics(test_session, date_range_days=30)

        assert metrics["total_feeds"] == 4
        assert metrics["active_feeds"] == 3
        assert metrics["verified_feeds"] == 3
        assert metrics["total_topics"] == 5

    def test_calculate_summary_metrics_with_validations(
        self, test_session, sample_feeds, sample_validations
    ):
        """Validation-derived summary fields should be populated."""
        metrics = calculate_summary_metrics(test_session, date_range_days=30)

        assert 0.0 <= metrics["validation_success_rate"] <= 1.0
        assert metrics["avg_response_time"] > 0

    def test_calculate_summary_metrics_topic_filter(self, test_session, sample_feeds):
        """Topic filtering should narrow the counted feed set."""
        metrics = calculate_summary_metrics(test_session, date_range_days=30, topic="llm")

        assert metrics["total_feeds"] == 2
        assert metrics["active_feeds"] == 2


class TestTrendingTopics:
    """Tests for trending topics calculation."""

    def test_calculate_trending_topics(self, test_session, sample_feeds, sample_validations):
        """Trending topics should aggregate feed and validation activity."""
        trending = calculate_trending_topics(test_session, date_range_days=30, limit=10)

        assert isinstance(trending, list)
        assert len(trending) > 0
        assert {"topic", "feed_count", "validation_count"} <= trending[0].keys()

    def test_calculate_trending_topics_ordering(
        self, test_session, sample_feeds, sample_validations
    ):
        """Trending topics should be sorted by activity."""
        trending = calculate_trending_topics(test_session, date_range_days=30, limit=10)

        if len(trending) >= 2:
            assert trending[0]["validation_count"] >= trending[1]["validation_count"]

    def test_calculate_trending_topics_limit(self, test_session, sample_feeds, sample_validations):
        """Trending topics should respect the requested limit."""
        trending = calculate_trending_topics(test_session, date_range_days=30, limit=2)

        assert len(trending) <= 2


class TestValidationVelocity:
    """Tests for validation velocity calculation."""

    def test_calculate_validation_velocity_daily(
        self, test_session, sample_feeds, sample_validations
    ):
        """Daily validation velocity should return dated datapoints."""
        velocity = calculate_validation_velocity(
            test_session, date_range_days=7, granularity="daily"
        )

        assert isinstance(velocity, list)
        assert len(velocity) > 0
        assert {"date", "count"} <= velocity[0].keys()

    def test_calculate_validation_velocity_monthly(
        self, test_session, sample_feeds, sample_validations
    ):
        """Monthly velocity should coalesce points into fewer buckets."""
        velocity = calculate_validation_velocity(
            test_session, date_range_days=90, granularity="monthly"
        )

        assert isinstance(velocity, list)
        assert len(velocity) <= 3


class TestHealthDistribution:
    """Tests for health distribution calculation."""

    def test_calculate_health_distribution(self, test_session, sample_feeds, sample_validations):
        """Health buckets should include healthy, moderate, and unhealthy counts."""
        distribution = calculate_health_distribution(test_session, date_range_days=30)

        assert distribution["healthy"] >= 1
        assert distribution["moderate"] >= 1
        assert distribution["unhealthy"] >= 1

    def test_calculate_health_distribution_no_validations(self, test_session, sample_feeds):
        """Quality scores should still drive a distribution without validations."""
        distribution = calculate_health_distribution(test_session, date_range_days=30)

        assert sum(distribution.values()) == len(sample_feeds)


class TestCSVReportGeneration:
    """Tests for CSV report generation."""

    def test_generate_analytics_csv_report(self, test_session, sample_feeds, sample_validations):
        """CSV export should include the major sections."""
        csv_content = generate_analytics_csv_report(test_session, date_range_days=30)

        assert isinstance(csv_content, str)
        assert "Analytics Summary" in csv_content
        assert "Most Active Topics" in csv_content
        assert "Publication Velocity" in csv_content


class TestAnalyticsSnapshot:
    """Tests for analytics snapshot generation."""

    def test_generate_analytics_snapshot(self, test_session, sample_feeds, sample_validations):
        """Snapshot generation should persist a daily rollup."""
        snapshot = generate_analytics_snapshot(test_session)

        saved_snapshot = test_session.exec(
            select(AnalyticsSnapshot).where(
                AnalyticsSnapshot.snapshot_date == snapshot.snapshot_date
            )
        ).first()

        assert saved_snapshot is not None
        assert saved_snapshot.total_feeds == 4
        assert isinstance(saved_snapshot.trending_topics, list)


@pytest.mark.parametrize("date_range_days", [7, 30, 90])
def test_summary_metrics_various_date_ranges(
    test_session, sample_feeds, sample_validations, date_range_days
):
    """Summary metrics should be stable across supported day ranges."""
    metrics = calculate_summary_metrics(test_session, date_range_days=date_range_days)

    assert metrics["total_feeds"] >= 0
    assert metrics["active_feeds"] >= 0


@pytest.mark.parametrize("granularity", ["daily", "weekly", "monthly"])
def test_velocity_various_granularities(
    test_session, sample_feeds, sample_validations, granularity
):
    """Velocity calculation should work for all supported granularities."""
    velocity = calculate_validation_velocity(
        test_session, date_range_days=30, granularity=granularity
    )

    assert isinstance(velocity, list)
    for point in velocity:
        assert {"date", "count"} <= point.keys()


@pytest.mark.parametrize("limit", [5, 10, 20])
def test_trending_topics_various_limits(test_session, sample_feeds, sample_validations, limit):
    """Trending topics should respect multiple limit values."""
    trending = calculate_trending_topics(test_session, date_range_days=30, limit=limit)

    assert len(trending) <= limit

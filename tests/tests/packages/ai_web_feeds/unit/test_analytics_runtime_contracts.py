"""Regression tests for analytics/model runtime contract alignment."""

from datetime import UTC, datetime, timedelta

from ai_web_feeds.analytics import calculate_summary_metrics, get_publication_velocity
from ai_web_feeds.models import FeedSource, FeedValidationResult
from sqlmodel import Session, SQLModel, create_engine


def test_summary_metrics_uses_current_validation_fields():
    """Summary metrics should use FeedValidationResult.is_valid and response_time_ms."""
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        session.add(
            FeedSource(id="feed-1", title="Feed 1", curation_status="verified", topics=["ai"])
        )
        session.add(
            FeedValidationResult(
                feed_source_id="feed-1",
                is_valid=True,
                response_time_ms=120.0,
                validated_at=datetime.now(UTC),
            )
        )
        session.add(
            FeedValidationResult(
                feed_source_id="feed-1",
                is_valid=False,
                response_time_ms=400.0,
                validated_at=datetime.now(UTC),
            )
        )
        session.commit()

        metrics = calculate_summary_metrics(session, date_range="30d")

    assert metrics["total_feeds"] == 1
    assert metrics["active_feeds"] == 1
    assert metrics["validation_success_rate"] == 0.5
    assert metrics["avg_response_time"] == 120.0


def test_publication_velocity_uses_is_valid():
    """Velocity should count only validations where is_valid is true."""
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)

    now = datetime.now(UTC)
    with Session(engine) as session:
        session.add(FeedSource(id="feed-2", title="Feed 2", curation_status="verified"))
        session.add(
            FeedValidationResult(
                feed_source_id="feed-2", is_valid=True, validated_at=now - timedelta(days=1)
            )
        )
        session.add(
            FeedValidationResult(
                feed_source_id="feed-2", is_valid=False, validated_at=now - timedelta(days=1)
            )
        )
        session.commit()

        velocity = get_publication_velocity(session, granularity="daily", date_range="7d")

    assert velocity["data_points"]
    assert sum(point["count"] for point in velocity["data_points"]) == 1

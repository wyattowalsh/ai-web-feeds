"""Characterization tests for analytics summary metrics.

Database access is mocked. These tests lock today's calculate_summary_metrics
behavior for one populated result and one empty input.
"""

from typing import cast
from unittest.mock import MagicMock

import pytest
from ai_web_feeds.analytics import calculate_summary_metrics
from ai_web_feeds.models import CurationStatus, FeedSource, FeedValidationResult
from sqlmodel import Session


def _session(
    feeds: list[FeedSource],
    validations: list[FeedValidationResult],
) -> Session:
    """Return a session whose two queries yield feeds, then validations."""
    feed_rows = MagicMock()
    feed_rows.all.return_value = feeds
    validation_rows = MagicMock()
    validation_rows.all.return_value = validations
    session = MagicMock()
    session.exec.side_effect = [feed_rows, validation_rows]
    return cast(Session, session)


@pytest.mark.unit
def test_calculate_summary_metrics_counts_successful_validation() -> None:
    """One healthy verified feed and one successful validation populate metrics."""
    feed = FeedSource(
        id="feed-1",
        title="Research Feed",
        topics=["llm"],
        verified=True,
        curation_status=CurationStatus.VERIFIED,
        quality_score=0.9,
    )
    validation = FeedValidationResult(
        feed_source_id="feed-1",
        is_valid=True,
        is_accessible=True,
        format_valid=True,
        response_time_ms=120.0,
    )

    metrics = calculate_summary_metrics(_session([feed], [validation]), date_range="30d")

    assert metrics["total_feeds"] == 1
    assert metrics["active_feeds"] == 1
    assert metrics["verified_feeds"] == 1
    assert metrics["total_topics"] == 1
    assert metrics["validation_success_rate"] == 1.0
    assert metrics["avg_response_time"] == 120.0
    assert metrics["health_distribution"] == {"healthy": 1, "moderate": 0, "unhealthy": 0}
    assert metrics["date_range"] == "30d"
    assert metrics["topic"] is None


@pytest.mark.unit
def test_calculate_summary_metrics_empty_inputs_are_zero() -> None:
    """No feeds and no validations yield zero counts and rates."""
    metrics = calculate_summary_metrics(_session([], []), date_range="7d")

    assert metrics["total_feeds"] == 0
    assert metrics["active_feeds"] == 0
    assert metrics["verified_feeds"] == 0
    assert metrics["total_topics"] == 0
    assert metrics["validation_success_rate"] == 0.0
    assert metrics["avg_response_time"] == 0.0
    assert metrics["health_distribution"] == {"healthy": 0, "moderate": 0, "unhealthy": 0}
    assert metrics["date_range"] == "7d"
    assert metrics["topic"] is None

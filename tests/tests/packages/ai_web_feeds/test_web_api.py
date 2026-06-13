"""Tests for the minimal backend API used by the web app."""

from datetime import UTC, datetime, timedelta

import pytest
from ai_web_feeds.models import (
    FeedSource,
    FeedValidationResult,
    RecommendationInteraction,
    UserProfile,
    UserSourceFollow,
)
from ai_web_feeds.web_api import create_app, get_db_session
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select


@pytest.fixture
def test_engine():
    """Create an in-memory SQLite engine for API tests."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def test_session(test_engine):
    """Create a test database session."""
    with Session(test_engine) as session:
        yield session


@pytest.fixture
def sample_feeds(test_session):
    """Create a few feeds for analytics and recommendation queries."""
    feeds = [
        FeedSource(
            id="feed-1",
            title="Agent Feed",
            feed="https://example.com/agent.xml",
            topics=["agents", "llm"],
            verified=True,
            curation_status="verified",
            popularity_score=0.9,
            quality_score=0.92,
            validation_count=120,
            notes="Recommendations seed feed",
        ),
        FeedSource(
            id="feed-2",
            title="Research Feed",
            feed="https://example.com/research.xml",
            topics=["research", "llm"],
            verified=True,
            curation_status="verified",
            popularity_score=0.82,
            quality_score=0.73,
            validation_count=80,
        ),
        FeedSource(
            id="feed-3",
            title="Vision Feed",
            feed="https://example.com/vision.xml",
            topics=["cv"],
            verified=False,
            curation_status="unverified",
            popularity_score=0.45,
            quality_score=0.4,
            validation_count=15,
        ),
    ]

    for feed in feeds:
        test_session.add(feed)

    test_session.commit()
    return feeds


@pytest.fixture
def sample_validations(test_session, sample_feeds):
    """Create validation history for analytics routes."""
    now = datetime.now(UTC)
    validations = [
        FeedValidationResult(
            feed_source_id="feed-1",
            is_valid=True,
            is_accessible=True,
            format_valid=True,
            has_items=True,
            item_count=20,
            http_status=200,
            response_time_ms=420,
            validated_at=now - timedelta(days=1),
        ),
        FeedValidationResult(
            feed_source_id="feed-2",
            is_valid=True,
            is_accessible=True,
            format_valid=True,
            has_items=True,
            item_count=14,
            http_status=200,
            response_time_ms=560,
            validated_at=now - timedelta(days=2),
        ),
        FeedValidationResult(
            feed_source_id="feed-3",
            is_valid=False,
            is_accessible=False,
            format_valid=False,
            has_items=False,
            http_status=404,
            response_time_ms=0,
            validated_at=now - timedelta(days=2),
        ),
    ]

    for validation in validations:
        test_session.add(validation)

    test_session.commit()
    return validations


@pytest.fixture
def client(test_engine, sample_feeds, sample_validations):
    """Create a test client with the database dependency overridden."""
    app = create_app()

    def override_session():
        with Session(test_engine) as session:
            yield session

    app.dependency_overrides[get_db_session] = override_session

    with TestClient(app) as test_client:
        yield test_client


def test_analytics_summary_returns_metrics_and_last_updated(client: TestClient):
    """Summary endpoint should expose the metrics used by the web dashboard."""
    response = client.get("/analytics/summary", params={"date_range": "30d"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_feeds"] == 3
    assert payload["active_feeds"] == 3
    assert payload["health_distribution"]["healthy"] >= 1
    assert payload["last_updated"]


def test_analytics_export_returns_csv_attachment(client: TestClient):
    """CSV export should pass through as a downloadable attachment."""
    response = client.get("/analytics/export", params={"date_range": "30d"})

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment; filename=" in response.headers["content-disposition"]
    assert "Analytics Summary" in response.text


def test_snapshot_endpoints_create_and_return_latest_snapshot(client: TestClient):
    """Snapshot creation should persist a record that the latest endpoint can read."""
    create_response = client.post("/analytics/snapshot")

    assert create_response.status_code == 201
    assert create_response.json()["snapshot_date"]

    latest_response = client.get("/analytics/snapshot")

    assert latest_response.status_code == 200
    assert latest_response.json()["snapshot_date"] == create_response.json()["snapshot_date"]


def test_recommendations_endpoint_returns_feed_payloads(client: TestClient):
    """Recommendations should preserve the feed payload expected by the web UI."""
    response = client.get(
        "/recommendations",
        params={"user_id": "user-1", "topics": "agents,llm", "limit": "5"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["recommendations"]
    recommendation = payload["recommendations"][0]
    assert recommendation["feed"]["id"]
    assert recommendation["feed"]["url"].startswith("https://")
    assert isinstance(recommendation["feed"]["topics"], list)
    assert recommendation["reason"] in {"similar_topics", "popular", "discover", "similar_content"}


def test_recommendation_interactions_update_user_profile(client: TestClient, test_session: Session):
    """Interaction tracking should persist feedback and normalized source follows."""
    response = client.post(
        "/recommendations/interactions",
        json={
            "user_id": "user-2",
            "feed_id": "feed-1",
            "interaction_type": "subscribe",
            "reason": "similar_topics",
        },
    )

    assert response.status_code == 201
    assert response.json() == {"tracked": True}

    test_session.expire_all()
    profile = test_session.get(UserProfile, "user-2")
    follow = test_session.exec(select(UserSourceFollow)).first()
    interactions = list(test_session.exec(select(RecommendationInteraction)).all())

    assert profile is not None
    assert follow is not None
    assert follow.user_id == "user-2"
    assert follow.source_id == "feed-1"
    assert "agents" in profile.preferred_topics
    assert interactions

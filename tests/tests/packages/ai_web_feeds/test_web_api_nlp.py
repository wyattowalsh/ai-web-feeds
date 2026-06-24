"""HTTP integration tests for /nlp/* backend routes."""

from datetime import UTC, datetime

import pytest
from ai_web_feeds.models import (
    ArticleEntry,
    ArticleQualityScore,
    ArticleSentiment,
    Entity,
    EntityMention,
    FeedSource,
    Subtopic,
)
from ai_web_feeds.web_api import create_app, get_db_session
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine


@pytest.fixture
def nlp_engine():
    """In-memory SQLite engine with NLP seed data."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)

    now = datetime.now(UTC)
    with Session(engine) as session:
        session.add(
            FeedSource(
                id="feed-nlp",
                title="NLP Feed",
                feed="https://example.com/nlp.xml",
                topics=["ai", "ml"],
                verified=True,
                curation_status="verified",
            )
        )
        session.add(
            ArticleEntry(
                id=1,
                feed_id="feed-nlp",
                guid="guid-1",
                link="https://example.com/a1",
                title="Article One",
                pub_date=now,
                topics=["ai"],
            )
        )
        session.add(
            ArticleQualityScore(
                article_id=1,
                overall_score=88,
                depth_score=90,
                reference_score=80,
                author_score=85,
                domain_score=82,
                engagement_score=70,
                computed_at=now,
            )
        )
        session.add(
            ArticleSentiment(
                article_id=1,
                sentiment_score=0.42,
                classification="positive",
                model_name="distilbert-base",
                confidence=0.91,
                computed_at=now,
            )
        )
        entity = Entity(
            id="ent-1",
            canonical_name="OpenAI",
            entity_type="organization",
            aliases=["Open AI"],
            frequency_count=12,
        )
        session.add(entity)
        session.add(
            EntityMention(
                entity_id="ent-1",
                article_id=1,
                confidence=0.95,
                extraction_method="ner_model",
                context="OpenAI released a model",
            )
        )
        session.add(
            Subtopic(
                id="sub-1",
                parent_topic="ai",
                name="LLM Agents",
                keywords=["agent", "tool-use"],
                article_count=42,
                approved=True,
                detected_at=now,
            )
        )
        session.commit()

    yield engine
    engine.dispose()


@pytest.fixture
def nlp_client(nlp_engine):
    """Test client with NLP fixtures."""
    app = create_app()

    def override_session():
        with Session(nlp_engine) as session:
            yield session

    app.dependency_overrides[get_db_session] = override_session

    with TestClient(app) as client:
        yield client


def test_nlp_quality_get_by_article_id(nlp_client: TestClient):
    response = nlp_client.get("/nlp/quality/1")

    assert response.status_code == 200
    payload = response.json()
    assert payload["article_id"] == 1
    assert payload["overall_score"] == 88


def test_nlp_quality_get_missing_returns_404(nlp_client: TestClient):
    response = nlp_client.get("/nlp/quality/999")

    assert response.status_code == 404


def test_nlp_quality_list_with_min_score(nlp_client: TestClient):
    response = nlp_client.get("/nlp/quality", params={"min_score": 80, "limit": 10})

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 1
    assert payload["scores"][0]["article_id"] == 1


def test_nlp_entities_for_article(nlp_client: TestClient):
    response = nlp_client.get("/nlp/entities", params={"article_id": 1})

    assert response.status_code == 200
    payload = response.json()
    assert payload["article_id"] == 1
    assert payload["count"] == 1
    assert payload["entities"][0]["canonical_name"] == "OpenAI"


def test_nlp_entities_recent_list(nlp_client: TestClient):
    response = nlp_client.get("/nlp/entities", params={"limit": 5})

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] >= 1
    assert payload["entities"][0]["entity_type"] == "organization"


def test_nlp_sentiment_get_by_article_id(nlp_client: TestClient):
    response = nlp_client.get("/nlp/sentiment/1")

    assert response.status_code == 200
    payload = response.json()
    assert payload["classification"] == "positive"
    assert payload["sentiment_score"] == pytest.approx(0.42)


def test_nlp_sentiment_get_missing_returns_404(nlp_client: TestClient):
    response = nlp_client.get("/nlp/sentiment/404")

    assert response.status_code == 404


def test_nlp_sentiment_list_filter(nlp_client: TestClient):
    response = nlp_client.get("/nlp/sentiment", params={"classification": "positive"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 1


def test_nlp_topics_list_subtopics(nlp_client: TestClient):
    response = nlp_client.get("/nlp/topics", params={"parent_topic": "ai", "approved": True})

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 1
    assert payload["subtopics"][0]["name"] == "LLM Agents"

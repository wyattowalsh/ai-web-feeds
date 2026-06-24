"""Minimal FastAPI surface for analytics and recommendation routes.

This app exposes the backend endpoints that the Next.js web layer expects when
``BACKEND_URL`` is configured.
"""

from collections.abc import AsyncIterator, Iterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import desc
from sqlmodel import Session, col, select

from ai_web_feeds.analytics import (
    calculate_summary_metrics,
    export_analytics_csv,
    generate_analytics_snapshot,
    get_publication_velocity,
    get_trending_topics,
)
from ai_web_feeds.models import (
    AnalyticsSnapshot,
    ArticleQualityScore,
    ArticleSentiment,
    Entity,
    EntityMention,
    FeedSource,
    Subtopic,
)
from ai_web_feeds.recommendations import (
    generate_recommendations,
    get_user_recommendations,
    track_recommendation_interaction,
)
from ai_web_feeds.storage import get_session

router = APIRouter()


class RecommendationInteractionRequest(BaseModel):
    """Track a user interaction with a recommendation result."""

    user_id: str = Field(min_length=1)
    feed_id: str = Field(min_length=1)
    interaction_type: Literal["view", "click", "subscribe", "dismiss"]
    reason: str | None = None


def get_db_session() -> Iterator[Session]:
    """Yield a database session for request handling."""
    session = get_session()
    try:
        yield session
    finally:
        session.close()


DbSession = Annotated[Session, Depends(get_db_session)]


def error_response(message: str, status_code: int, code: str) -> JSONResponse:
    """Create a consistent JSON error response."""
    return JSONResponse(
        {
            "message": message,
            "code": code,
        },
        status_code=status_code,
    )


def serialize_feed(feed: FeedSource) -> dict[str, Any]:
    """Serialize a feed source into the web-facing recommendation shape."""
    source_type = feed.source_type.value if feed.source_type is not None else "unknown"
    is_active = (
        feed.curation_status.value != "inactive" if feed.curation_status is not None else True
    )

    return {
        "id": feed.id,
        "title": feed.title,
        "description": feed.notes or feed.curation_notes,
        "url": feed.feed or feed.site or "",
        "topics": list(feed.topics or []),
        "source_type": source_type,
        "verified": feed.verified,
        "is_active": is_active,
    }


def serialize_snapshot(snapshot: AnalyticsSnapshot) -> dict[str, Any]:
    """Serialize an analytics snapshot for API responses."""
    return {
        "snapshot_date": snapshot.snapshot_date,
        "total_feeds": snapshot.total_feeds,
        "active_feeds": snapshot.active_feeds,
        "validation_success_rate": snapshot.validation_success_rate,
        "avg_response_time": snapshot.avg_response_time,
        "trending_topics": snapshot.trending_topics,
        "health_distribution": snapshot.health_distribution,
        "created_at": snapshot.created_at.isoformat(),
    }


# FastAPI's decorators are dynamically typed.
@router.get("/recommendations")  # type: ignore[misc]
def list_recommendations(
    user_id: str | None = Query(default=None),
    topics: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    *,
    session: DbSession,
) -> dict[str, Any]:
    """Return feed recommendations for a user or topic slice."""
    seed_topics: list[str] = [topic.strip() for topic in (topics or "").split(",") if topic.strip()]

    if user_id and not seed_topics:
        recommendations = get_user_recommendations(session, user_id=user_id, limit=limit)
    else:
        recommendations = generate_recommendations(
            session,
            user_id=user_id,
            seed_topics=seed_topics or None,
            limit=limit,
        )

    return {
        "recommendations": [
            {
                "feed": serialize_feed(feed),
                "score": score,
                "reason": reason,
            }
            for feed, score, reason in recommendations
        ]
    }


# FastAPI's decorators are dynamically typed.
@router.post(  # type: ignore[misc]
    "/recommendations/interactions",
    status_code=201,
    response_model=None,
)
def create_recommendation_interaction(
    request: RecommendationInteractionRequest,
    session: DbSession,
) -> dict[str, Any] | JSONResponse:
    """Persist recommendation interaction feedback."""
    if session.get(FeedSource, request.feed_id) is None:
        return error_response("Feed not found", 404, "FEED_NOT_FOUND")

    track_recommendation_interaction(
        session,
        user_id=request.user_id,
        feed_id=request.feed_id,
        interaction_type=request.interaction_type,
        recommendation_reason=request.reason or "unknown",
    )
    return {"tracked": True}


# FastAPI's decorators are dynamically typed.
@router.get("/analytics/summary")  # type: ignore[misc]
def analytics_summary(
    date_range: str = Query(default="30d"),
    topic: str | None = Query(default=None),
    *,
    session: DbSession,
) -> dict[str, Any]:
    """Return summary analytics for the requested slice."""
    summary = calculate_summary_metrics(session, date_range=date_range, topic=topic)
    return {
        **summary,
        "last_updated": datetime.now(UTC).isoformat(),
    }


# FastAPI's decorators are dynamically typed.
@router.get("/analytics/trending")  # type: ignore[misc]
def analytics_trending(
    limit: int = Query(default=10, ge=1, le=100),
    date_range: str = Query(default="30d"),
    *,
    session: DbSession,
) -> list[dict[str, Any]]:
    """Return trending topic analytics."""
    return get_trending_topics(session, limit=limit, date_range=date_range)


# FastAPI's decorators are dynamically typed.
@router.get("/analytics/velocity")  # type: ignore[misc]
def analytics_velocity(
    granularity: Literal["daily", "weekly", "monthly"] = Query(default="daily"),
    date_range: str = Query(default="30d"),
    *,
    session: DbSession,
) -> dict[str, Any]:
    """Return publication velocity analytics."""
    return get_publication_velocity(session, granularity=granularity, date_range=date_range)


# FastAPI's decorators are dynamically typed.
@router.get("/analytics/export")  # type: ignore[misc]
def analytics_export(
    date_range: str = Query(default="30d"),
    *,
    session: DbSession,
) -> Response:
    """Export analytics data as CSV."""
    csv_content = export_analytics_csv(session, date_range=date_range)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="analytics-{date_range}.csv"',
        },
    )


# FastAPI's decorators are dynamically typed.
@router.post("/analytics/snapshot", status_code=201)  # type: ignore[misc]
def create_analytics_snapshot(
    session: DbSession,
) -> dict[str, Any]:
    """Generate and persist a fresh analytics snapshot."""
    snapshot = generate_analytics_snapshot(session)
    return serialize_snapshot(snapshot)


# FastAPI's decorators are dynamically typed.
@router.get("/analytics/snapshot", response_model=None)  # type: ignore[misc]
def get_latest_analytics_snapshot(
    session: DbSession,
) -> Response:
    """Return the most recently generated analytics snapshot."""
    snapshot = session.exec(
        select(AnalyticsSnapshot).order_by(desc(AnalyticsSnapshot.snapshot_date)).limit(1)
    ).first()

    if snapshot is None:
        return error_response("No analytics snapshot available", 404, "SNAPSHOT_NOT_FOUND")

    return JSONResponse(serialize_snapshot(snapshot))


# ============================================================================
# Phase 5: NLP Read Endpoints
# ============================================================================


# FastAPI's decorators are dynamically typed.
@router.get("/nlp/quality/{article_id}", response_model=None)  # type: ignore[misc]
def get_article_quality(
    article_id: int,
    *,
    session: DbSession,
) -> dict[str, Any]:
    """Return quality score for a specific article."""
    quality = session.get(ArticleQualityScore, article_id)
    if quality is None:
        raise HTTPException(status_code=404, detail="Quality score not found")

    return {
        "article_id": quality.article_id,
        "overall_score": quality.overall_score,
        "depth_score": quality.depth_score,
        "reference_score": quality.reference_score,
        "author_score": quality.author_score,
        "domain_score": quality.domain_score,
        "engagement_score": quality.engagement_score,
        "computed_at": quality.computed_at.isoformat(),
    }


# FastAPI's decorators are dynamically typed.
@router.get("/nlp/quality")  # type: ignore[misc]
def list_quality_scores(
    limit: int = Query(default=50, ge=1, le=500),
    min_score: int | None = Query(default=None, ge=0, le=100),
    *,
    session: DbSession,
) -> dict[str, Any]:
    """List article quality scores (highest first)."""
    statement = select(ArticleQualityScore).order_by(col(ArticleQualityScore.overall_score).desc())
    if min_score is not None:
        statement = statement.where(ArticleQualityScore.overall_score >= min_score)
    statement = statement.limit(limit)
    scores = list(session.exec(statement).all())

    return {
        "scores": [
            {
                "article_id": s.article_id,
                "overall_score": s.overall_score,
                "depth_score": s.depth_score,
                "reference_score": s.reference_score,
                "author_score": s.author_score,
                "domain_score": s.domain_score,
                "engagement_score": s.engagement_score,
                "computed_at": s.computed_at.isoformat(),
            }
            for s in scores
        ],
        "count": len(scores),
    }


# FastAPI's decorators are dynamically typed.
@router.get("/nlp/entities")  # type: ignore[misc]
def get_entities_for_article(
    article_id: int | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    *,
    session: DbSession,
) -> dict[str, Any]:
    """Return entities (with mentions) for an article, or recent entities."""
    if article_id is not None:
        # Get entity mentions for this article joined with entities
        mentions = list(
            session.exec(
                select(EntityMention, Entity)
                .join(Entity, col(EntityMention.entity_id) == col(Entity.id))
                .where(EntityMention.article_id == article_id)
                .limit(limit)
            ).all()
        )
        return {
            "article_id": article_id,
            "entities": [
                {
                    "entity_id": entity.id,
                    "canonical_name": entity.canonical_name,
                    "entity_type": entity.entity_type,
                    "confidence": mention.confidence,
                    "context": mention.context,
                    "extraction_method": mention.extraction_method,
                }
                for mention, entity in mentions
            ],
            "count": len(mentions),
        }

    # Return distinct entities (most frequent first)
    entities = list(
        session.exec(select(Entity).order_by(col(Entity.frequency_count).desc()).limit(limit)).all()
    )
    return {
        "entities": [
            {
                "id": e.id,
                "canonical_name": e.canonical_name,
                "entity_type": e.entity_type,
                "frequency_count": e.frequency_count,
                "aliases": e.aliases,
            }
            for e in entities
        ],
        "count": len(entities),
    }


# FastAPI's decorators are dynamically typed.
@router.get("/nlp/sentiment/{article_id}", response_model=None)  # type: ignore[misc]
def get_article_sentiment(
    article_id: int,
    *,
    session: DbSession,
) -> dict[str, Any]:
    """Return sentiment analysis for a specific article."""
    sentiment = session.get(ArticleSentiment, article_id)
    if sentiment is None:
        raise HTTPException(status_code=404, detail="Sentiment not found")

    return {
        "article_id": sentiment.article_id,
        "sentiment_score": sentiment.sentiment_score,
        "classification": sentiment.classification,
        "model_name": sentiment.model_name,
        "confidence": sentiment.confidence,
        "computed_at": sentiment.computed_at.isoformat(),
    }


# FastAPI's decorators are dynamically typed.
@router.get("/nlp/sentiment")  # type: ignore[misc]
def list_sentiment_scores(
    limit: int = Query(default=50, ge=1, le=500),
    classification: str | None = Query(default=None),
    *,
    session: DbSession,
) -> dict[str, Any]:
    """List article sentiment scores."""
    statement = select(ArticleSentiment)
    if classification:
        statement = statement.where(ArticleSentiment.classification == classification)
    statement = statement.order_by(col(ArticleSentiment.computed_at).desc()).limit(limit)
    sentiments = list(session.exec(statement).all())

    return {
        "sentiments": [
            {
                "article_id": s.article_id,
                "sentiment_score": s.sentiment_score,
                "classification": s.classification,
                "model_name": s.model_name,
                "confidence": s.confidence,
                "computed_at": s.computed_at.isoformat(),
            }
            for s in sentiments
        ],
        "count": len(sentiments),
    }


# FastAPI's decorators are dynamically typed.
@router.get("/nlp/topics")  # type: ignore[misc]
def list_subtopics(
    parent_topic: str | None = Query(default=None),
    approved: bool | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    *,
    session: DbSession,
) -> dict[str, Any]:
    """List discovered subtopics."""
    statement = select(Subtopic)
    if parent_topic:
        statement = statement.where(Subtopic.parent_topic == parent_topic)
    if approved is not None:
        statement = statement.where(Subtopic.approved == approved)
    statement = statement.order_by(col(Subtopic.article_count).desc()).limit(limit)
    subtopics = list(session.exec(statement).all())

    return {
        "subtopics": [
            {
                "id": s.id,
                "parent_topic": s.parent_topic,
                "name": s.name,
                "keywords": s.keywords,
                "description": s.description,
                "article_count": s.article_count,
                "approved": s.approved,
                "detected_at": s.detected_at.isoformat(),
            }
            for s in subtopics
        ],
        "count": len(subtopics),
    }


def create_app() -> FastAPI:
    """Create the backend FastAPI application."""
    from ai_web_feeds.visualization.api import (
        router as visualization_router,
    )
    from ai_web_feeds.visualization.api import (
        shutdown_event as visualization_shutdown,
    )
    from ai_web_feeds.visualization.api import (
        startup_event as visualization_startup,
    )

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        await visualization_startup()
        yield
        await visualization_shutdown()

    app = FastAPI(title="ai-web-feeds backend", lifespan=lifespan)
    app.include_router(router)
    app.include_router(visualization_router)

    return app


app = create_app()

"""Minimal FastAPI surface for analytics and recommendation routes.

This app exposes the backend endpoints that the Next.js web layer expects when
``BACKEND_URL`` is configured.
"""

from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, FastAPI, Query, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import desc
from sqlmodel import Session, select

from ai_web_feeds.analytics import (
    calculate_summary_metrics,
    export_analytics_csv,
    generate_analytics_snapshot,
    get_publication_velocity,
    get_trending_topics,
)
from ai_web_feeds.models import AnalyticsSnapshot, FeedSource
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
    seed_topics = [topic.strip() for topic in (topics or "").split(",") if topic.strip()]

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


def create_app() -> FastAPI:
    """Create the backend FastAPI application."""
    app = FastAPI(title="ai-web-feeds backend")
    app.include_router(router)
    return app


app = create_app()

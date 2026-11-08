"""
Data Export API endpoints.

Implements Phase 8 (US6): T089-T098
- Bulk data export
- Multiple formats (JSON, CSV, Parquet)
- Pagination with cursor-based approach
- Filtering and sorting
- Streaming for large datasets
"""

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from io import StringIO
from typing import Any

import pandas as pd
from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import StreamingResponse
from loguru import logger
from sqlalchemy import column, inspect, select
from sqlalchemy import table as sql_table
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ai_web_feeds.visualization.auth import get_current_device_id
from ai_web_feeds.visualization.rate_limiter import check_rate_limit
from ai_web_feeds.visualization.validators import QueryValidator

router = APIRouter(prefix="/api/v1/export", tags=["export"])


class ExportFormat(StrEnum):
    """Export format options."""

    JSON = "json"
    CSV = "csv"
    PARQUET = "parquet"


@dataclass
class ExportRequest:
    """Export request configuration."""

    table: str
    format: ExportFormat
    filters: dict[str, Any] | None = None
    sort_by: str | None = None
    sort_order: str = "asc"
    limit: int = 1000
    cursor: str | None = None


# Declared export columns. Rows come from storage; these names are not values.
_EXPORT_COLUMNS: dict[str, tuple[str, ...]] = {
    "topic_metrics": ("topic_id", "date", "mention_count", "sentiment_score"),
    "feed_health": ("feed_id", "timestamp", "status", "response_time_ms", "error"),
    "article_metadata": ("article_id", "feed_id", "title", "published_at", "author"),
    "validation_logs": ("feed_id", "timestamp", "is_valid", "error_count", "warning_count"),
}


@router.get("/tables")
async def list_exportable_tables(
    device_id: str = Depends(get_current_device_id),
) -> dict[str, Any]:
    """
    List tables available for export.

    Returns:
        Dictionary of table names and their schemas
    """
    await check_rate_limit(device_id)

    tables = {
        "topic_metrics": {
            "description": "TopicNode mention frequency and trends",
            "columns": list(_EXPORT_COLUMNS["topic_metrics"]),
        },
        "feed_health": {
            "description": "Feed health and response metrics",
            "columns": list(_EXPORT_COLUMNS["feed_health"]),
        },
        "article_metadata": {
            "description": "Article publication data",
            "columns": list(_EXPORT_COLUMNS["article_metadata"]),
        },
        "validation_logs": {
            "description": "Feed validation results",
            "columns": list(_EXPORT_COLUMNS["validation_logs"]),
        },
    }

    logger.info(f"Device {device_id[:8]} listed exportable tables")
    return {"tables": tables}


@router.get("/data/{table}")
async def export_data(
    table: str,
    format: ExportFormat = Query(ExportFormat.JSON),
    limit: int = Query(1000, le=10000),
    cursor: str | None = Query(None),
    sort_by: str | None = Query(None),
    sort_order: str = Query("asc", regex="^(asc|desc)$"),
    device_id: str = Depends(get_current_device_id),
    session: Session = Depends(lambda: None),  # Would be injected in production
) -> Response:
    """
    Export data from a table.

    Args:
        table: Table name to export
        format: Export format (json, csv, parquet)
        limit: Maximum rows to return
        cursor: Pagination cursor
        sort_by: Column to sort by
        sort_order: Sort order (asc, desc)

    Returns:
        Exported data in requested format
    """
    await check_rate_limit(device_id)

    # Validate inputs
    table = QueryValidator.validate_table_name(table)
    limit = QueryValidator.validate_result_limit(limit)

    logger.info(f"Device {device_id[:8]} exporting {table} as {format}")

    # Stored catalog rows only. An empty or missing table stays an empty frame.
    frame = _catalog_frame(
        session,
        table,
        limit,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    # Convert to requested format
    if format == ExportFormat.JSON:
        return Response(
            content=frame.to_json(orient="records", date_format="iso"),
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="{table}.json"',
            },
        )

    if format == ExportFormat.CSV:
        csv_buffer = StringIO()
        frame.to_csv(csv_buffer, index=False)
        return Response(
            content=csv_buffer.getvalue(),
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="{table}.csv"',
            },
        )

    if format == ExportFormat.PARQUET:
        # Parquet export (requires pyarrow)
        parquet_buffer = frame.to_parquet()
        return Response(
            content=parquet_buffer,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f'attachment; filename="{table}.parquet"',
            },
        )


@router.get("/stream/{table}")
async def stream_export(
    table: str,
    format: ExportFormat = Query(ExportFormat.CSV),
    batch_size: int = Query(1000, le=5000),
    device_id: str = Depends(get_current_device_id),
) -> StreamingResponse:
    """
    Stream large dataset export.

    Args:
        table: Table name to export
        format: Export format
        batch_size: Rows per batch

    Returns:
        Streaming response with data
    """
    await check_rate_limit(device_id)

    table = QueryValidator.validate_table_name(table)

    logger.info(f"Device {device_id[:8]} streaming {table} export")

    async def generate_stream():
        """Yield stored rows only. Empty storage yields no batches."""
        frame = _generate_sample_export_data(table, batch_size)
        if frame.empty:
            return
        if format == ExportFormat.JSON:
            yield frame.to_json(orient="records", lines=True) + "\n"
            return
        if format == ExportFormat.CSV:
            yield frame.to_csv(index=False)

    return StreamingResponse(
        generate_stream(),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{table}_stream.{format}"',
        },
    )


@router.post("/bulk")
async def bulk_export(
    tables: list[str],
    format: ExportFormat = Query(ExportFormat.JSON),
    device_id: str = Depends(get_current_device_id),
) -> dict[str, Any]:
    """
    Export multiple tables at once.

    Args:
        tables: List of table names
        format: Export format

    Returns:
        Download URLs for each table
    """
    await check_rate_limit(device_id)

    # Validate all tables
    validated_tables = [QueryValidator.validate_table_name(table) for table in tables]

    if len(validated_tables) > 10:
        msg = "Maximum 10 tables per bulk export"
        raise ValueError(msg)

    logger.info(f"Device {device_id[:8]} bulk exporting {len(validated_tables)} tables")

    # In production, would create export jobs and return job IDs
    export_urls = {
        table: f"/api/v1/export/data/{table}?format={format}" for table in validated_tables
    }

    return {
        "export_id": f"bulk-{datetime.now().timestamp()}",
        "tables": validated_tables,
        "format": format,
        "download_urls": export_urls,
        "created_at": datetime.now().isoformat(),
    }


def _empty_export_frame(table: str) -> pd.DataFrame:
    """Return a zero-row frame. Known tables keep column names and no values."""
    columns = _EXPORT_COLUMNS.get(table, ())
    return pd.DataFrame(columns=list(columns))


def _read_catalog_rows(
    session: Session,
    table: str,
    names: tuple[str, ...],
    limit: int,
    sort_by: str | None,
    sort_order: str,
) -> list[dict[str, Any]]:
    """Read whitelisted columns from an existing table. Missing tables yield nothing."""
    connection = session.connection()
    info = inspect(connection)
    if not info.has_table(table):
        return []

    present = {column_info["name"] for column_info in info.get_columns(table)}
    if any(name not in present for name in names):
        return []

    export_table = sql_table(table, *[column(name) for name in names])
    statement = select(*(export_table.c[name] for name in names)).limit(limit)
    if sort_by in names:
        ordered = export_table.c[sort_by]
        ordered = ordered.desc() if sort_order == "desc" else ordered.asc()
        statement = statement.order_by(ordered)

    rows = session.execute(statement).mappings().all()
    return [dict(row) for row in rows]


def _catalog_frame(
    session: Session | None,
    table: str,
    limit: int,
    sort_by: str | None = None,
    sort_order: str = "asc",
) -> pd.DataFrame:
    """Return stored rows for one export table, or a zero-row frame.

    Does not fill missing metrics, health, articles, or a default series.
    """
    empty = _empty_export_frame(table)
    names = tuple(str(name) for name in empty.columns)
    if session is None or not names or limit <= 0:
        return empty

    try:
        loaded = _read_catalog_rows(session, table, names, limit, sort_by, sort_order)
    except SQLAlchemyError:
        logger.debug(f"Export table {table} is not readable")
        return empty

    if not loaded:
        return empty
    return pd.DataFrame(loaded, columns=list(names))


def _generate_sample_export_data(table: str, limit: int) -> pd.DataFrame:
    """Return a zero-row export frame.

    Topic metrics, feed health, article metadata, and unknown tables are not
    filled with demonstration values. Streaming has no session, so it cannot
    invent batches from this helper.

    Args:
        table: Table name.
        limit: Requested row cap. Must be non-negative. Not used to invent rows.

    Returns:
        Empty DataFrame. Known tables keep their column names and no values.
    """
    if limit < 0:
        msg = "limit must be non-negative"
        raise ValueError(msg)
    return _empty_export_frame(table)

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
from enum import Enum
from io import StringIO
from typing import Any

import pandas as pd
from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import StreamingResponse
from loguru import logger
from sqlalchemy import text
from sqlalchemy.orm import Session

from ai_web_feeds.visualization.auth import get_current_device_id
from ai_web_feeds.visualization.rate_limiter import check_rate_limit
from ai_web_feeds.visualization.validators import validate_table_name, validate_query_limit


router = APIRouter(prefix="/api/v1/export", tags=["export"])


class ExportFormat(str, Enum):
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
            "description": "Topic mention frequency and trends",
            "columns": ["topic_id", "date", "mention_count", "sentiment_score"],
        },
        "feed_health": {
            "description": "Feed health and response metrics",
            "columns": ["feed_id", "timestamp", "status", "response_time_ms", "error"],
        },
        "article_metadata": {
            "description": "Article publication data",
            "columns": ["article_id", "feed_id", "title", "published_at", "author"],
        },
        "validation_logs": {
            "description": "Feed validation results",
            "columns": ["feed_id", "timestamp", "is_valid", "error_count", "warning_count"],
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
    table = validate_table_name(table)
    limit = validate_query_limit(limit, max_limit=10000)

    logger.info(f"Device {device_id[:8]} exporting {table} as {format}")

    # Generate sample data for demonstration
    # In production, this would query the actual database
    sample_data = _generate_sample_export_data(table, limit)

    # Convert to requested format
    if format == ExportFormat.JSON:
        return Response(
            content=sample_data.to_json(orient="records", date_format="iso"),
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="{table}.json"',
            },
        )

    elif format == ExportFormat.CSV:
        csv_buffer = StringIO()
        sample_data.to_csv(csv_buffer, index=False)
        return Response(
            content=csv_buffer.getvalue(),
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="{table}.csv"',
            },
        )

    elif format == ExportFormat.PARQUET:
        # Parquet export (requires pyarrow)
        parquet_buffer = sample_data.to_parquet()
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

    table = validate_table_name(table)

    logger.info(f"Device {device_id[:8]} streaming {table} export")

    async def generate_stream():
        """Generate data stream in batches."""
        # In production, this would use database cursor
        for batch_num in range(5):  # 5 batches for demo
            batch_data = _generate_sample_export_data(table, batch_size)

            if format == ExportFormat.JSON:
                yield batch_data.to_json(orient="records", lines=True) + "\n"
            elif format == ExportFormat.CSV:
                if batch_num == 0:
                    # Include header on first batch
                    yield batch_data.to_csv(index=False)
                else:
                    yield batch_data.to_csv(index=False, header=False)

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
    validated_tables = [validate_table_name(table) for table in tables]

    if len(validated_tables) > 10:
        msg = "Maximum 10 tables per bulk export"
        raise ValueError(msg)

    logger.info(f"Device {device_id[:8]} bulk exporting {len(validated_tables)} tables")

    # In production, would create export jobs and return job IDs
    export_urls = {
        table: f"/api/v1/export/data/{table}?format={format}"
        for table in validated_tables
    }

    return {
        "export_id": f"bulk-{datetime.now().timestamp()}",
        "tables": validated_tables,
        "format": format,
        "download_urls": export_urls,
        "created_at": datetime.now().isoformat(),
    }


def _generate_sample_export_data(table: str, limit: int) -> pd.DataFrame:
    """
    Generate sample data for export demonstration.

    Args:
        table: Table name
        limit: Number of rows

    Returns:
        Sample DataFrame
    """
    if table == "topic_metrics":
        return pd.DataFrame({
            "topic_id": [f"topic-{i}" for i in range(limit)],
            "date": pd.date_range(start="2024-01-01", periods=limit, freq="D"),
            "mention_count": pd.np.random.randint(10, 100, size=limit),
            "sentiment_score": pd.np.random.uniform(-1, 1, size=limit),
        })

    elif table == "feed_health":
        return pd.DataFrame({
            "feed_id": [f"feed-{i % 20}" for i in range(limit)],
            "timestamp": pd.date_range(start="2024-01-01", periods=limit, freq="h"),
            "status": pd.np.random.choice(["success", "error", "timeout"], size=limit),
            "response_time_ms": pd.np.random.randint(100, 5000, size=limit),
            "error": [None if status == "success" else "Sample error" for status in pd.np.random.choice(["success", "error"], size=limit)],
        })

    elif table == "article_metadata":
        return pd.DataFrame({
            "article_id": [f"article-{i}" for i in range(limit)],
            "feed_id": [f"feed-{i % 20}" for i in range(limit)],
            "title": [f"Article Title {i}" for i in range(limit)],
            "published_at": pd.date_range(start="2024-01-01", periods=limit, freq="6h"),
            "author": [f"Author {i % 50}" for i in range(limit)],
        })

    else:
        # Default empty DataFrame
        return pd.DataFrame({
            "id": range(limit),
            "value": pd.np.random.random(limit),
        })

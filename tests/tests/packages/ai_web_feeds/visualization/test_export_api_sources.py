"""Characterization tests for visualization export API sources.

Locks public callables and the empty-store contract. An empty temp database is
the source. Synthetic numeric series are rejected, not snapshotted.
"""

from __future__ import annotations

import inspect
import json
from collections.abc import Iterator, Mapping, Sized
from contextlib import contextmanager
from pathlib import Path
from typing import Any

import pytest
from ai_web_feeds.visualization import export_api
from ai_web_feeds.visualization.export_api import (
    ExportFormat,
    ExportRequest,
    bulk_export,
    export_data,
    list_exportable_tables,
    stream_export,
)
from fastapi.responses import StreamingResponse
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

_PUBLIC_CALLABLES: tuple[str, ...] = (
    "list_exportable_tables",
    "export_data",
    "stream_export",
    "bulk_export",
)

_CATALOG_COLUMNS: dict[str, list[str]] = {
    "topic_metrics": ["topic_id", "date", "mention_count", "sentiment_score"],
    "feed_health": ["feed_id", "timestamp", "status", "response_time_ms", "error"],
    "article_metadata": ["article_id", "feed_id", "title", "published_at", "author"],
    "validation_logs": ["feed_id", "timestamp", "is_valid", "error_count", "warning_count"],
}

_EMPTY_SERIES: dict[str, object] = {"demo": False, "points": []}

_STORED_ARTICLES: tuple[dict[str, str], ...] = (
    {
        "article_id": "b-stored",
        "feed_id": "feed-b",
        "title": "Second stored",
        "published_at": "2024-05-02T00:00:00",
        "author": "Author B",
    },
    {
        "article_id": "a-stored",
        "feed_id": "feed-a",
        "title": "First stored",
        "published_at": "2024-05-01T00:00:00",
        "author": "Author A",
    },
)


@contextmanager
def _empty_sqlite_session(database_path: Path) -> Iterator[Session]:
    """Yield a session bound to a temp SQLite file with no user tables."""
    engine: Engine = create_engine(f"sqlite:///{database_path}")
    session: Session = Session(engine)
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _assert_empty_collection_or_mapping(value: object) -> None:
    """Empty storage may be a mapping or a collection with no rows."""
    if isinstance(value, Mapping):
        return
    assert isinstance(value, (list, tuple))
    assert len(value) == 0


def _json_body(result: object) -> Any:
    """Parse a response body when the endpoint returned encoded JSON."""
    body: object = getattr(result, "body", b"")
    if isinstance(body, memoryview):
        body = body.tobytes()
    if not isinstance(body, (bytes, bytearray)) or not body:
        return None
    return json.loads(body)


def _assert_empty_export_value(value: object, columns: list[str]) -> None:
    """Empty store is the frozen series contract or a zero-row frame."""
    if isinstance(value, Mapping):
        assert dict(value) == _EMPTY_SERIES
        return
    frame_columns = getattr(value, "columns", None)
    assert frame_columns is not None
    assert [str(name) for name in list(frame_columns)] == columns
    assert isinstance(value, Sized)
    assert len(value) == 0


async def _stream_bytes(result: StreamingResponse) -> bytes:
    """Read a streaming body once. Does not invent replacement rows."""
    parts: list[bytes] = []
    async for chunk in result.body_iterator:
        if isinstance(chunk, str):
            parts.append(chunk.encode())
            continue
        if isinstance(chunk, memoryview):
            parts.append(chunk.tobytes())
            continue
        parts.append(bytes(chunk))
    return b"".join(parts)


def _assert_collection_or_mapping_shape(result: object) -> None:
    """Accept a mapping, a collection of mappings, or a response carrying one.

    Streaming bodies are not read, so synthetic batches are never materialized.
    """
    if isinstance(result, Mapping):
        return
    if isinstance(result, (list, tuple)):
        assert all(isinstance(item, Mapping) for item in result)
        return
    if isinstance(result, StreamingResponse):
        return
    parsed: Any = _json_body(result)
    if isinstance(parsed, Mapping):
        return
    if isinstance(parsed, list):
        assert all(isinstance(item, Mapping) for item in parsed)
        return
    raise AssertionError(f"expected a collection or mapping, got {type(result).__name__}")


@pytest.mark.unit
class TestExportApiSources:
    """Public export API names, shapes, and empty-storage behavior."""

    def test_public_callables_exist(self) -> None:
        for name in _PUBLIC_CALLABLES:
            assert callable(getattr(export_api, name))

        assert {item.value for item in ExportFormat} == {"json", "csv", "parquet"}
        request = ExportRequest(table="topic_metrics", format=ExportFormat.JSON)
        assert request.table == "topic_metrics"
        assert request.format is ExportFormat.JSON
        assert request.filters is None
        assert request.sort_by is None
        assert request.sort_order == "asc"
        assert request.limit == 1000
        assert request.cursor is None

        paths = {
            path
            for route in export_api.router.routes
            if isinstance(path := getattr(route, "path", None), str)
        }
        assert "/api/v1/export/tables" in paths
        assert "/api/v1/export/data/{table}" in paths
        assert "/api/v1/export/stream/{table}" in paths
        assert "/api/v1/export/bulk" in paths

        source = inspect.getsource(export_api)
        assert "np.random" not in source
        assert "default_rng" not in source

    @pytest.mark.asyncio
    async def test_list_exportable_tables_returns_mapping(self) -> None:
        listed = await list_exportable_tables(device_id="export-catalog-device")

        assert isinstance(listed, Mapping)
        tables = listed["tables"]
        assert isinstance(tables, Mapping)
        assert set(tables) == set(_CATALOG_COLUMNS)
        for table_name, columns in _CATALOG_COLUMNS.items():
            spec = tables[table_name]
            assert isinstance(spec, Mapping)
            assert isinstance(spec["description"], str)
            assert spec["description"]
            assert spec["columns"] == columns

    @pytest.mark.asyncio
    async def test_empty_storage_returns_empty_collection_or_mapping(self, tmp_path: Path) -> None:
        with _empty_sqlite_session(tmp_path / "empty-export.db") as session:
            stored_tables = session.execute(
                text("SELECT name FROM sqlite_master WHERE type = 'table'")
            ).all()
            _assert_empty_collection_or_mapping(stored_tables)

            exported = await bulk_export(
                [],
                format=ExportFormat.JSON,
                device_id="export-empty-bulk",
            )
            _assert_empty_collection_or_mapping(exported)
            assert isinstance(exported["tables"], list)
            assert exported["tables"] == []
            assert isinstance(exported["download_urls"], Mapping)
            assert exported["download_urls"] == {}
            assert isinstance(exported["export_id"], str)
            assert exported["export_id"].startswith("bulk-")
            assert exported["format"] == ExportFormat.JSON
            assert isinstance(exported["created_at"], str)

            data_result = await export_data(
                "article_metadata",
                format=ExportFormat.JSON,
                limit=1,
                cursor=None,
                sort_by=None,
                sort_order="asc",
                device_id="export-empty-data",
                session=session,
            )
            _assert_collection_or_mapping_shape(data_result)
            assert _json_body(data_result) == []

            stream_result = await stream_export(
                "article_metadata",
                format=ExportFormat.CSV,
                batch_size=1,
                device_id="export-empty-stream",
            )
            _assert_collection_or_mapping_shape(stream_result)
            assert isinstance(stream_result, StreamingResponse)
            assert await _stream_bytes(stream_result) == b""

    def test_sample_frames_have_no_synthetic_rows(self) -> None:
        """Known tables and the default frame stay empty. No numeric series."""
        for table_name, columns in _CATALOG_COLUMNS.items():
            frame = export_api._generate_sample_export_data(table_name, 5)
            _assert_empty_export_value(frame, columns)

        default_frame = export_api._generate_sample_export_data("not-a-catalog-table", 3)
        _assert_empty_export_value(default_frame, [])

        with pytest.raises(ValueError, match="non-negative"):
            export_api._generate_sample_export_data("topic_metrics", -1)

    @pytest.mark.asyncio
    async def test_export_returns_only_stored_rows(self, tmp_path: Path) -> None:
        """A seeded table is exported as stored. Missing tables stay empty."""
        with _empty_sqlite_session(tmp_path / "stored-export.db") as session:
            session.execute(
                text(
                    """
                    CREATE TABLE article_metadata (
                        article_id TEXT,
                        feed_id TEXT,
                        title TEXT,
                        published_at TEXT,
                        author TEXT
                    )
                    """
                )
            )
            session.execute(
                text(
                    """
                    INSERT INTO article_metadata (
                        article_id, feed_id, title, published_at, author
                    ) VALUES (
                        :article_id, :feed_id, :title, :published_at, :author
                    )
                    """
                ),
                list(_STORED_ARTICLES),
            )
            session.commit()

            exported = await export_data(
                "article_metadata",
                format=ExportFormat.JSON,
                limit=10,
                cursor=None,
                sort_by="article_id",
                sort_order="asc",
                device_id="export-stored-rows",
                session=session,
            )
            parsed = _json_body(exported)
            assert parsed == [
                _STORED_ARTICLES[1],
                _STORED_ARTICLES[0],
            ]

            limited = await export_data(
                "article_metadata",
                format=ExportFormat.JSON,
                limit=1,
                sort_by="article_id",
                sort_order="asc",
                device_id="export-stored-limit",
                session=session,
            )
            assert _json_body(limited) == [_STORED_ARTICLES[1]]

            missing = await export_data(
                "topic_metrics",
                format=ExportFormat.JSON,
                limit=10,
                device_id="export-missing-table",
                session=session,
            )
            assert _json_body(missing) == []

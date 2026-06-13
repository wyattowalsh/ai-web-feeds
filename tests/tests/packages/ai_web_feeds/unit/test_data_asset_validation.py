"""Unit tests for data/validate_data_assets.py helper contracts."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
from uuid import uuid4

import pytest


def _load_data_validator_module():
    module_path = Path(__file__).resolve().parents[5] / "data" / "validate_data_assets.py"
    spec = importlib.util.spec_from_file_location("validate_data_assets_module", module_path)
    if spec is None or spec.loader is None:
        msg = f"Unable to load validator module from {module_path}"
        raise RuntimeError(msg)

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


data_validator = _load_data_validator_module()


def _write_json(path: Path, payload: dict[str, object]) -> Path:
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


@pytest.mark.unit
def test_validate_sample_analytics_data_accepts_current_consumer_shape(tmp_path: Path):
    """Analytics samples should mirror the current summary + trending payload shapes."""
    payload = {
        "sample_analytics_snapshots": [
            {
                "snapshot_date": "2025-11-01",
                "total_feeds": 10,
                "active_feeds": 9,
                "validation_success_rate": 0.95,
                "avg_response_time": 120.0,
                "trending_topics": [
                    {
                        "topic": "llm",
                        "feed_count": 6,
                        "validation_frequency": 0.91,
                        "avg_health_score": 0.88,
                    }
                ],
                "health_distribution": {
                    "healthy": 7,
                    "moderate": 2,
                    "unhealthy": 1,
                },
            }
        ],
        "sample_topic_stats": [
            {
                "id": str(uuid4()),
                "topic": "llm",
                "feed_count": 6,
                "validation_frequency": 0.91,
                "avg_health_score": 0.88,
                "snapshot_date": "2025-11-01",
            }
        ],
    }

    sample_path = _write_json(tmp_path / "sample_analytics_data.json", payload)

    assert data_validator.validate_sample_analytics_data(
        sample_path,
        "sample analytics",
        {"llm"},
    )


@pytest.mark.unit
def test_validate_sample_analytics_data_rejects_unsupported_snapshot_topic_shape(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
):
    """Z-score snapshot payloads should fail the current consumer contract check."""
    payload = {
        "sample_analytics_snapshots": [
            {
                "snapshot_date": "2025-11-01",
                "total_feeds": 10,
                "active_feeds": 9,
                "validation_success_rate": 0.95,
                "avg_response_time": 120.0,
                "trending_topics": [{"topic": "llm", "article_count": 42, "z_score": 3.1}],
                "health_distribution": {
                    "healthy": 7,
                    "moderate": 2,
                    "unhealthy": 1,
                },
            }
        ],
        "sample_topic_stats": [
            {
                "id": str(uuid4()),
                "topic": "llm",
                "feed_count": 6,
                "validation_frequency": 0.91,
                "avg_health_score": 0.88,
                "snapshot_date": "2025-11-01",
            }
        ],
    }

    sample_path = _write_json(tmp_path / "sample_analytics_data.json", payload)

    assert not data_validator.validate_sample_analytics_data(
        sample_path,
        "sample analytics",
        {"llm"},
    )
    assert (
        "missing fields: avg_health_score, feed_count, validation_frequency"
        in capsys.readouterr().out
    )


@pytest.mark.unit
def test_validate_sqlite_asset_inventory_rejects_unexpected_db_files(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
):
    """Unexpected scratch databases in data/ should fail validation."""
    (tmp_path / "test1.db").write_bytes(b"")

    assert not data_validator.validate_sqlite_asset_inventory(tmp_path)
    assert "Unexpected database file: test1.db" in capsys.readouterr().out


@pytest.mark.unit
def test_validate_sqlite_asset_inventory_rejects_unsupported_filename(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
):
    """The old sqlite filename is not accepted as a data asset."""
    (tmp_path / "aiwebfeeds.db").write_bytes(b"")

    assert not data_validator.validate_sqlite_asset_inventory(tmp_path)
    assert "Unexpected database file: aiwebfeeds.db" in capsys.readouterr().out


@pytest.mark.unit
def test_validate_catalog_metadata_quality_rejects_url_titles_and_duplicate_ids(
    capsys: pytest.CaptureFixture[str],
):
    """Generated catalogs should fail obvious metadata quality regressions."""
    catalog = {
        "sources": [
            {
                "id": "feed-1",
                "url": "https://example.com/feed.xml",
                "title": "https://example.com/feed.xml",
                "source_type": "blog",
                "topics": ["agents"],
            },
            {
                "id": "feed-1",
                "url": "https://example.com/other.xml",
                "title": "Example Feed",
                "source_type": "blog",
                "topics": ["agents"],
            },
            {
                "id": "feed-3",
                "url": "https://example.com/blank-type.xml",
                "title": "Useful Feed",
                "source_type": "   ",
                "topics": ["agents"],
            },
            {
                "id": "feed-4",
                "url": "https://example.com/missing-topics.xml",
                "title": "Missing Topics Feed",
                "source_type": "blog",
            },
        ]
    }

    assert not data_validator.validate_catalog_metadata_quality(catalog, "catalog")
    output = capsys.readouterr().out
    assert "uses a URL as its title" in output
    assert "Duplicate canonical source id 'feed-1'" in output
    assert "has a blank source_type" in output
    assert "is missing topics" in output
    assert "Coverage summary" in output


@pytest.mark.unit
def test_validate_catalog_metadata_quality_accepts_clean_catalog():
    """Generated catalogs with stable titles and ids should pass."""
    catalog = {
        "sources": [
            {
                "id": "feed-1",
                "url": "https://example.com/feed.xml",
                "title": "Example Feed",
                "source_type": "blog",
                "topics": ["agents"],
            },
            {
                "id": "feed-2",
                "url": "https://example.com/news.xml",
                "title": "Example News",
                "source_type": "newsroom",
                "topics": ["industry"],
            },
        ]
    }

    assert data_validator.validate_catalog_metadata_quality(catalog, "catalog")


@pytest.mark.unit
def test_validate_catalog_metadata_quality_rejects_missing_source_type_and_empty_topics(
    capsys: pytest.CaptureFixture[str],
):
    """Clean catalogs now require explicit source_type values and non-empty topics."""
    catalog = {
        "sources": [
            {
                "id": "feed-1",
                "url": "https://example.com/feed.xml",
                "title": "Example Feed",
                "topics": ["agents"],
            },
            {
                "id": "feed-2",
                "url": "https://example.com/empty-topics.xml",
                "title": "Empty Topics Feed",
                "source_type": "blog",
                "topics": [],
            },
        ]
    }

    assert not data_validator.validate_catalog_metadata_quality(catalog, "catalog")
    output = capsys.readouterr().out
    assert "is missing source_type" in output
    assert "has an empty topics list" in output

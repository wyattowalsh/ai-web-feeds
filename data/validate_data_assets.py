#!/usr/bin/env python3
"""Validate canonical data assets and generated derivatives."""

import json
import sqlite3
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET

import yaml
from jsonschema import Draft202012Validator

try:
    from ai_web_feeds.config import DEFAULT_DATABASE_FILENAME, LEGACY_DATABASE_FILENAME
    from ai_web_feeds.export import (
        build_export_data,
        build_opml_category_map,
        render_opml,
    )
    from ai_web_feeds.load import canonicalize_catalog
    from ai_web_feeds.models import AnalyticsSnapshot, TopicStats
    from ai_web_feeds.validate import (
        validate_feeds as validate_feed_runtime_contract,
    )
    from ai_web_feeds.validate import (
        validate_topics as validate_topic_runtime_contract,
    )
except Exception as exc:  # pragma: no cover - exercised by CLI/runtime environment
    DEFAULT_DATABASE_FILENAME = "ai-web-feeds.db"
    LEGACY_DATABASE_FILENAME = "aiwebfeeds.db"
    build_export_data = None
    build_opml_category_map = None
    render_opml = None
    canonicalize_catalog = None
    AnalyticsSnapshot = None
    TopicStats = None
    validate_feed_runtime_contract = None
    validate_topic_runtime_contract = None
    IMPORT_ERROR = exc
else:
    IMPORT_ERROR = None

_ALLOWED_DATABASE_FILENAMES = frozenset({DEFAULT_DATABASE_FILENAME, LEGACY_DATABASE_FILENAME})
_EXPECTED_HEALTH_DISTRIBUTION_KEYS = frozenset({"healthy", "moderate", "unhealthy"})
_EXPECTED_TRENDING_TOPIC_FIELDS = frozenset(
    {"topic", "feed_count", "validation_frequency", "avg_health_score"}
)
_URL_TITLE_PREFIXES = ("http://", "https://")


def _ok(message: str) -> None:
    sys.stdout.write(f"✓ {message}\n")


def _fail(message: str) -> None:
    sys.stdout.write(f"✗ {message}\n")


def load_json_file(filepath: Path) -> Any:
    """Load a JSON file from disk."""
    return json.loads(filepath.read_text())


def load_yaml_file(filepath: Path) -> Any:
    """Load a YAML file from disk."""
    data = yaml.safe_load(filepath.read_text())
    if data is None:
        return {}
    return data


def validate_json_file(filepath: Path, description: str) -> bool:
    """Validate a JSON file can be loaded."""
    try:
        data = load_json_file(filepath)
    except Exception as exc:
        _fail(f"{description}: Failed - {exc}")
        return False

    _ok(f"{description}: Valid JSON with {len(str(data))} characters")
    return True


def validate_yaml_file(
    filepath: Path,
    description: str,
    schema_path: Path | None = None,
    runtime_validator: Callable[[dict[str, Any]], Any] | None = None,
) -> tuple[bool, dict[str, Any]]:
    """Validate a YAML file can be loaded and optionally checked against a schema."""
    try:
        data = load_yaml_file(filepath)
        if not isinstance(data, dict):
            _fail(f"{description}: YAML root must be an object")
            return False, {}

        _ok(f"{description}: Valid YAML")
        if "sources" in data:
            sys.stdout.write(f"  - Found {len(data['sources'])} sources\n")
        if "topics" in data:
            sys.stdout.write(f"  - Found {len(data['topics'])} topics\n")

        if schema_path:
            schema = load_json_file(schema_path)
            validator = Draft202012Validator(schema)
            errors = sorted(
                validator.iter_errors(data), key=lambda error: list(error.absolute_path)
            )
            if errors:
                _fail(f"{description}: Schema validation failed ({len(errors)} errors)")
                for error in errors[:10]:
                    path = ".".join(str(part) for part in error.absolute_path) or "<root>"
                    sys.stdout.write(f"  - {path}: {error.message}\n")
                return False, data

            sys.stdout.write(f"  - Schema validation passed ({schema_path.name})\n")

        if runtime_validator:
            result = runtime_validator(data)
            if not result.valid:
                _fail(
                    f"{description}: Runtime contract validation failed ({len(result.errors)} errors)"
                )
                for error in result.errors[:10]:
                    sys.stdout.write(f"  - {error}\n")
                return False, data

            sys.stdout.write("  - Runtime contract validation passed\n")
    except Exception as exc:
        _fail(f"{description}: Failed - {exc}")
        return False, {}

    return True, data


def validate_json_matches(filepath: Path, description: str, expected: Any) -> bool:
    """Validate a generated JSON asset matches the expected in-memory structure."""
    try:
        actual = load_json_file(filepath)
    except Exception as exc:
        _fail(f"{description}: Failed - {exc}")
        return False

    if actual != expected:
        _fail(f"{description}: Generated JSON is out of date")
        return False

    _ok(f"{description}: Matches canonical export")
    return True


def validate_text_matches(filepath: Path, description: str, expected: str) -> bool:
    """Validate a generated text asset matches the expected serialized output."""
    try:
        actual = filepath.read_text()
    except Exception as exc:
        _fail(f"{description}: Failed - {exc}")
        return False

    if actual != expected:
        _fail(f"{description}: Generated file is out of date")
        return False

    _ok(f"{description}: Matches canonical export")
    return True


def validate_topics_cross_references(
    topics_data: dict[str, Any],
    description: str,
) -> tuple[bool, set[str]]:
    """Validate topic parent and relation references against the in-file topic set."""
    topic_ids = {
        topic["id"]
        for topic in topics_data.get("topics", [])
        if isinstance(topic, dict) and isinstance(topic.get("id"), str)
    }
    errors: list[str] = []

    for topic in topics_data.get("topics", []):
        if not isinstance(topic, dict):
            continue

        topic_id = topic.get("id", "<unknown>")
        for parent in topic.get("parents", []):
            if parent not in topic_ids:
                errors.append(f"Topic '{topic_id}' references unknown parent '{parent}'")

        relations = topic.get("relations") or {}
        for relation_name, related_ids in relations.items():
            if not isinstance(related_ids, list):
                continue
            for related_id in related_ids:
                if related_id not in topic_ids:
                    errors.append(
                        f"Topic '{topic_id}' references unknown {relation_name} target "
                        f"'{related_id}'"
                    )

    if errors:
        _fail(f"{description}: Cross-reference validation failed ({len(errors)} errors)")
        for error in errors[:10]:
            sys.stdout.write(f"  - {error}\n")
        return False, topic_ids

    _ok(f"{description}: Cross-reference validation passed")
    return True, topic_ids


def validate_feed_topic_references(
    catalog: dict[str, Any],
    topic_ids: set[str],
    description: str,
) -> bool:
    """Validate that every feed topic reference resolves to the canonical taxonomy."""
    errors: list[str] = []
    for source in catalog.get("sources", []):
        if not isinstance(source, dict):
            continue

        source_label = source.get("id") or source.get("title") or source.get("url") or "<unknown>"
        for topic_id in source.get("topics", []):
            if topic_id not in topic_ids:
                errors.append(f"Source '{source_label}' references unknown topic '{topic_id}'")

        meta = source.get("meta") or {}
        suggested_topics = meta.get("suggested_topics") or []
        for topic_id in suggested_topics:
            if topic_id not in topic_ids:
                errors.append(
                    f"Source '{source_label}' meta.suggested_topics references unknown topic "
                    f"'{topic_id}'"
                )

        topic_confidence = meta.get("topic_confidence") or {}
        for topic_id, score in topic_confidence.items():
            if topic_id not in topic_ids:
                errors.append(
                    f"Source '{source_label}' meta.topic_confidence references unknown topic "
                    f"'{topic_id}'"
                )
            if not isinstance(score, (int, float)) or not 0 <= score <= 1:
                errors.append(
                    f"Source '{source_label}' meta.topic_confidence['{topic_id}'] has "
                    f"out-of-range score '{score}'"
                )

    if errors:
        _fail(f"{description}: Topic reference validation failed ({len(errors)} errors)")
        for error in errors[:10]:
            sys.stdout.write(f"  - {error}\n")
        return False

    _ok(f"{description}: Topic reference validation passed")
    return True


def validate_catalog_source_count(catalog: dict[str, Any], description: str) -> bool:
    """Validate optional document_meta.total_sources declarations."""
    total_sources = catalog.get("document_meta", {}).get("total_sources")
    if total_sources is None:
        _ok(f"{description}: No declared source count to validate")
        return True

    if not isinstance(total_sources, int):
        _fail(f"{description}: document_meta.total_sources must be an integer")
        return False

    actual_sources = [
        source for source in catalog.get("sources", []) if isinstance(source, dict)
    ]
    if total_sources != len(actual_sources):
        _fail(
            f"{description}: document_meta.total_sources does not match the source count "
            f"({total_sources} != {len(actual_sources)})"
        )
        return False

    _ok(f"{description}: document_meta.total_sources matches the source count")
    return True


def _looks_like_url_title(value: str) -> bool:
    stripped = value.strip().lower()
    return stripped.startswith(_URL_TITLE_PREFIXES)


def _print_catalog_metadata_coverage_summary(
    total_sources: int,
    title_count: int,
    source_type_count: int,
    topics_count: int,
) -> None:
    """Emit a coverage summary separate from hard validation failures."""
    sys.stdout.write("  - Coverage summary:\n")
    sys.stdout.write(f"    • titles={title_count}/{total_sources}\n")
    sys.stdout.write(f"    • source_type={source_type_count}/{total_sources}\n")
    sys.stdout.write(f"    • topics={topics_count}/{total_sources}\n")


def validate_catalog_metadata_quality(catalog: dict[str, Any], description: str) -> bool:
    """Validate obvious catalog metadata quality issues in enriched/source-derived catalogs."""
    errors: list[str] = []
    seen_ids: set[str] = set()
    title_count = 0
    source_type_count = 0
    topics_count = 0

    for index, source in enumerate(catalog.get("sources", [])):
        if not isinstance(source, dict):
            errors.append(f"sources[{index}] must be an object")
            continue

        source_label = source.get("id") or source.get("url") or f"sources[{index}]"
        title = source.get("title")
        if not isinstance(title, str) or not title.strip():
            errors.append(f"Source '{source_label}' is missing a non-empty title")
        elif _looks_like_url_title(title):
            errors.append(f"Source '{source_label}' uses a URL as its title")
        else:
            title_count += 1

        source_id = source.get("id")
        if isinstance(source_id, str):
            normalized_id = source_id.strip()
            if not normalized_id:
                errors.append(f"Source '{source_label}' has a blank canonical id")
            elif normalized_id in seen_ids:
                errors.append(f"Duplicate canonical source id '{normalized_id}'")
            else:
                seen_ids.add(normalized_id)

        source_type = source.get("source_type")
        if source_type is None:
            errors.append(f"Source '{source_label}' is missing source_type")
        elif not isinstance(source_type, str) or not source_type.strip():
            errors.append(f"Source '{source_label}' has a blank source_type")
        else:
            source_type_count += 1

        topics = source.get("topics")
        if not isinstance(topics, list):
            errors.append(f"Source '{source_label}' is missing topics")
        elif len(topics) == 0:
            errors.append(f"Source '{source_label}' has an empty topics list")
        elif any(not isinstance(topic, str) or not topic.strip() for topic in topics):
            errors.append(f"Source '{source_label}' has a blank topic entry")
        else:
            topics_count += 1

    total_sources = len([source for source in catalog.get("sources", []) if isinstance(source, dict)])

    if errors:
        _fail(f"{description}: Metadata quality validation failed ({len(errors)} hard failures)")
        for error in errors[:10]:
            sys.stdout.write(f"  - {error}\n")
        _print_catalog_metadata_coverage_summary(
            total_sources,
            title_count,
            source_type_count,
            topics_count,
        )
        return False

    _ok(f"{description}: Metadata quality validation passed")
    _print_catalog_metadata_coverage_summary(
        total_sources,
        title_count,
        source_type_count,
        topics_count,
    )
    return True


def _parse_opml_file(filepath: Path) -> ET.Element:
    """Parse an OPML file and return its body element."""
    tree = ET.parse(filepath)
    root = tree.getroot()
    body = root.find("body")
    if body is None:
        msg = "OPML document is missing a <body> element"
        raise ValueError(msg)
    return body


def _expected_source_count(catalog: dict[str, Any]) -> int:
    """Return the canonical source count expected in flat OPML exports."""
    if build_export_data is None:
        msg = f"Import failed - {IMPORT_ERROR}"
        raise RuntimeError(msg)

    export_data = build_export_data(catalog)
    return len([source for source in export_data.get("sources", []) if isinstance(source, dict)])


def validate_flat_opml_parity(
    filepath: Path,
    description: str,
    catalog: dict[str, Any],
) -> bool:
    """Validate flat OPML exports against the canonical catalog feed count."""
    try:
        body = _parse_opml_file(filepath)
        expected_count = _expected_source_count(catalog)
    except Exception as exc:
        _fail(f"{description}: Failed - {exc}")
        return False

    actual_count = len(
        [
            outline
            for outline in body.findall("outline")
            if isinstance(outline.get("xmlUrl"), str) and outline.get("xmlUrl")
        ]
    )
    if actual_count != expected_count:
        _fail(
            f"{description}: Flat OPML parity failed "
            f"({actual_count} feeds != expected {expected_count})"
        )
        return False

    _ok(f"{description}: Flat OPML parity passed ({actual_count} feeds)")
    return True


def validate_categorized_opml_parity(
    filepath: Path,
    description: str,
    catalog: dict[str, Any],
    topic_ids: set[str],
) -> bool:
    """Validate categorized OPML exports against canonical topic placements."""
    if build_opml_category_map is None:
        _fail(f"{description}: Import failed - {IMPORT_ERROR}")
        return False

    try:
        body = _parse_opml_file(filepath)
        expected_categories = build_opml_category_map(catalog)
    except Exception as exc:
        _fail(f"{description}: Failed - {exc}")
        return False

    actual_categories: dict[str, int] = {}
    errors: list[str] = []

    for category_outline in body.findall("outline"):
        category = category_outline.get("text") or category_outline.get("title")
        if not isinstance(category, str) or not category:
            errors.append("Encountered a category outline without text/title")
            continue
        if category in actual_categories:
            errors.append(f"Duplicate category outline '{category}'")
            continue

        if category != "Uncategorized" and category not in topic_ids:
            errors.append(f"Unknown categorized OPML topic '{category}'")

        actual_categories[category] = len(
            [
                outline
                for outline in category_outline.findall("outline")
                if isinstance(outline.get("xmlUrl"), str) and outline.get("xmlUrl")
            ]
        )

    expected_category_ids = set(expected_categories)
    actual_category_ids = set(actual_categories)
    missing_categories = sorted(expected_category_ids - actual_category_ids)
    extra_categories = sorted(actual_category_ids - expected_category_ids)

    if missing_categories:
        errors.append(f"Missing categories: {', '.join(missing_categories[:10])}")
    if extra_categories:
        errors.append(f"Unexpected categories: {', '.join(extra_categories[:10])}")

    expected_placements = 0
    actual_placements = sum(actual_categories.values())
    for category, category_sources in expected_categories.items():
        expected_count = len([source for source in category_sources if isinstance(source, dict)])
        expected_placements += expected_count
        actual_count = actual_categories.get(category, 0)
        if actual_count != expected_count:
            errors.append(
                f"Category '{category}' placement count is out of sync "
                f"({actual_count} != {expected_count})"
            )

    if actual_placements != expected_placements:
        errors.append(
            "Categorized OPML feed placement count does not match the canonical topic "
            f"placements ({actual_placements} != {expected_placements})"
        )

    if errors:
        _fail(f"{description}: Categorized OPML parity failed")
        for error in errors[:10]:
            sys.stdout.write(f"  - {error}\n")
        return False

    _ok(
        f"{description}: Categorized OPML parity passed "
        f"({len(actual_categories)} categories, {actual_placements} placements)"
    )
    return True


def validate_enriched_catalog(
    feeds_data: dict[str, Any],
    enriched_data: dict[str, Any],
) -> bool:
    """Validate the enriched catalog stays in lockstep with the canonical feed catalog."""
    if canonicalize_catalog is None:
        _fail(f"feeds.enriched.yaml (generated enriched catalog): Import failed - {IMPORT_ERROR}")
        return False

    expected_catalog = canonicalize_catalog(feeds_data, enriched=True)
    expected_sources = {source["id"]: source for source in expected_catalog.get("sources", [])}
    actual_sources = {
        source.get("id"): source
        for source in enriched_data.get("sources", [])
        if isinstance(source, dict) and isinstance(source.get("id"), str)
    }

    errors: list[str] = []
    missing_ids = sorted(set(expected_sources) - set(actual_sources))
    extra_ids = sorted(set(actual_sources) - set(expected_sources))
    if missing_ids:
        errors.append(f"Missing enriched sources: {', '.join(missing_ids[:10])}")
    if extra_ids:
        errors.append(f"Unexpected enriched sources: {', '.join(extra_ids[:10])}")

    for source_id, expected_source in expected_sources.items():
        actual_source = actual_sources.get(source_id)
        if not actual_source:
            continue

        for field in ("url", "feed", "site", "title", "topics", "tags", "notes"):
            if expected_source.get(field) != actual_source.get(field):
                errors.append(
                    f"Source '{source_id}' field '{field}' is out of sync: "
                    f"expected {expected_source.get(field)!r}, got {actual_source.get(field)!r}"
                )
                break

        expected_source_type = expected_source.get("source_type")
        actual_source_type = actual_source.get("source_type")
        if expected_source_type is not None and expected_source_type != actual_source_type:
            errors.append(
                f"Source '{source_id}' field 'source_type' is out of sync: "
                f"expected {expected_source_type!r}, got {actual_source_type!r}"
            )

    total_sources = enriched_data.get("document_meta", {}).get("total_sources")
    if total_sources is not None and total_sources != len(actual_sources):
        errors.append(
            "document_meta.total_sources does not match the enriched source count "
            f"({total_sources} != {len(actual_sources)})"
        )

    if errors:
        _fail("feeds.enriched.yaml (generated enriched catalog): Synchronization failed")
        for error in errors[:10]:
            sys.stdout.write(f"  - {error}\n")
        return False

    _ok("feeds.enriched.yaml (generated enriched catalog): Matches canonical feed inputs")
    return True


def validate_sample_analytics_data(
    filepath: Path,
    description: str,
    topic_ids: set[str],
) -> bool:
    """Validate sample analytics data against the current analytics models."""
    if AnalyticsSnapshot is None or TopicStats is None:
        _fail(f"{description}: Import failed - {IMPORT_ERROR}")
        return False

    try:
        data = load_json_file(filepath)
    except Exception as exc:
        _fail(f"{description}: Failed - {exc}")
        return False

    snapshots = data.get("sample_analytics_snapshots")
    topic_stats = data.get("sample_topic_stats")

    if not isinstance(snapshots, list) or not isinstance(topic_stats, list):
        _fail(
            f"{description}: Expected 'sample_analytics_snapshots' and "
            "'sample_topic_stats' arrays"
        )
        return False

    errors: list[str] = []
    snapshot_dates: set[str] = set()
    for index, snapshot_payload in enumerate(snapshots):
        if not isinstance(snapshot_payload, dict):
            errors.append(f"sample_analytics_snapshots[{index}] must be an object")
            continue
        try:
            snapshot = AnalyticsSnapshot(**snapshot_payload)
        except Exception as exc:
            errors.append(f"sample_analytics_snapshots[{index}] failed model validation: {exc}")
            continue

        snapshot_dates.add(snapshot.snapshot_date)

        health_distribution = snapshot_payload.get("health_distribution")
        if not isinstance(health_distribution, dict):
            errors.append(
                f"sample_analytics_snapshots[{index}].health_distribution must be an object"
            )
        else:
            health_keys = {str(key) for key in health_distribution}
            missing_health_keys = sorted(_EXPECTED_HEALTH_DISTRIBUTION_KEYS - health_keys)
            unexpected_health_keys = sorted(health_keys - _EXPECTED_HEALTH_DISTRIBUTION_KEYS)
            if missing_health_keys:
                errors.append(
                    "sample_analytics_snapshots"
                    f"[{index}].health_distribution is missing keys: "
                    f"{', '.join(missing_health_keys)}"
                )
            if unexpected_health_keys:
                errors.append(
                    "sample_analytics_snapshots"
                    f"[{index}].health_distribution has unexpected keys: "
                    f"{', '.join(unexpected_health_keys)}"
                )

            for key in _EXPECTED_HEALTH_DISTRIBUTION_KEYS:
                value = health_distribution.get(key)
                if not isinstance(value, int) or isinstance(value, bool) or value < 0:
                    errors.append(
                        "sample_analytics_snapshots"
                        f"[{index}].health_distribution['{key}'] must be a non-negative integer"
                    )

        trending_topics = snapshot_payload.get("trending_topics")
        if not isinstance(trending_topics, list):
            errors.append(f"sample_analytics_snapshots[{index}].trending_topics must be an array")
            continue

        for topic_index, topic_payload in enumerate(trending_topics):
            if not isinstance(topic_payload, dict):
                errors.append(
                    f"sample_analytics_snapshots[{index}].trending_topics[{topic_index}] "
                    "must be an object"
                )
                continue

            missing_topic_fields = sorted(
                _EXPECTED_TRENDING_TOPIC_FIELDS - set(topic_payload)
            )
            if missing_topic_fields:
                errors.append(
                    "sample_analytics_snapshots"
                    f"[{index}].trending_topics[{topic_index}] is missing fields: "
                    f"{', '.join(missing_topic_fields)}"
                )
                continue

            topic_id = topic_payload.get("topic")
            if not isinstance(topic_id, str) or not topic_id:
                errors.append(
                    "sample_analytics_snapshots"
                    f"[{index}].trending_topics[{topic_index}].topic must be a non-empty string"
                )
            elif topic_id not in topic_ids:
                errors.append(
                    "sample_analytics_snapshots"
                    f"[{index}].trending_topics[{topic_index}] references unknown topic "
                    f"'{topic_id}'"
                )

            feed_count = topic_payload.get("feed_count")
            if not isinstance(feed_count, int) or isinstance(feed_count, bool) or feed_count < 0:
                errors.append(
                    "sample_analytics_snapshots"
                    f"[{index}].trending_topics[{topic_index}].feed_count must be a "
                    "non-negative integer"
                )

            validation_frequency = topic_payload.get("validation_frequency")
            if (
                not isinstance(validation_frequency, (int, float))
                or isinstance(validation_frequency, bool)
                or validation_frequency < 0
            ):
                errors.append(
                    "sample_analytics_snapshots"
                    f"[{index}].trending_topics[{topic_index}].validation_frequency must be "
                    "a non-negative number"
                )

            avg_health_score = topic_payload.get("avg_health_score")
            if (
                not isinstance(avg_health_score, (int, float))
                or isinstance(avg_health_score, bool)
                or not 0 <= avg_health_score <= 1
            ):
                errors.append(
                    "sample_analytics_snapshots"
                    f"[{index}].trending_topics[{topic_index}].avg_health_score must be "
                    "between 0.0 and 1.0"
                )

    seen_topic_snapshots: set[tuple[str, str]] = set()
    for index, topic_payload in enumerate(topic_stats):
        if not isinstance(topic_payload, dict):
            errors.append(f"sample_topic_stats[{index}] must be an object")
            continue
        try:
            topic_stat = TopicStats(**topic_payload)
        except Exception as exc:
            errors.append(f"sample_topic_stats[{index}] failed model validation: {exc}")
            continue

        if topic_stat.topic not in topic_ids:
            errors.append(
                f"sample_topic_stats[{index}] references unknown topic '{topic_stat.topic}'"
            )
        if snapshot_dates and topic_stat.snapshot_date not in snapshot_dates:
            errors.append(
                "sample_topic_stats"
                f"[{index}] snapshot_date '{topic_stat.snapshot_date}' does not match any "
                "sample analytics snapshot"
            )

        topic_snapshot_key = (topic_stat.snapshot_date, topic_stat.topic)
        if topic_snapshot_key in seen_topic_snapshots:
            errors.append(
                "sample_topic_stats"
                f"[{index}] duplicates topic '{topic_stat.topic}' for "
                f"snapshot_date '{topic_stat.snapshot_date}'"
            )
        else:
            seen_topic_snapshots.add(topic_snapshot_key)

    if errors:
        _fail(f"{description}: Analytics model compatibility failed")
        for error in errors[:10]:
            sys.stdout.write(f"  - {error}\n")
        return False

    _ok(f"{description}: Compatible with AnalyticsSnapshot and TopicStats models")
    sys.stdout.write(f"  - {len(snapshots)} AnalyticsSnapshot payloads\n")
    sys.stdout.write(f"  - {len(topic_stats)} TopicStats payloads\n")
    return True


def validate_sqlite_asset_inventory(base_path: Path) -> bool:
    """Validate repository data assets only include scoped SQLite filenames."""
    db_files = sorted(path.name for path in base_path.glob("*.db") if path.is_file())
    unexpected_db_files = [name for name in db_files if name not in _ALLOWED_DATABASE_FILENAMES]
    if unexpected_db_files:
        _fail("SQLite asset inventory includes unexpected database files")
        for name in unexpected_db_files[:10]:
            sys.stdout.write(f"  - Unexpected database file: {name}\n")
        return False

    if DEFAULT_DATABASE_FILENAME in db_files:
        if LEGACY_DATABASE_FILENAME in db_files:
            _ok(
                "SQLite asset inventory: canonical "
                f"{DEFAULT_DATABASE_FILENAME} takes precedence over legacy "
                f"{LEGACY_DATABASE_FILENAME}"
            )
        else:
            _ok(
                "SQLite asset inventory: canonical "
                f"{DEFAULT_DATABASE_FILENAME} is scoped correctly"
            )
    elif LEGACY_DATABASE_FILENAME in db_files:
        _ok(
            "SQLite asset inventory: using legacy "
            f"{LEGACY_DATABASE_FILENAME} as a fallback until "
            f"{DEFAULT_DATABASE_FILENAME} is materialized"
        )
    else:
        _ok("SQLite asset inventory: no unexpected database files found")

    return True


def validate_sqlite_db(filepath: Path, description: str) -> bool:
    """Validate SQLite database structure."""
    try:
        if not filepath.exists():
            msg = f"SQLite database asset not found: {filepath.name}"
            raise FileNotFoundError(msg)

        db_uri = f"file:{filepath.as_posix()}?mode=ro"
        conn = sqlite3.connect(db_uri, uri=True)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'")
        table_count = cursor.fetchone()[0]
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        tables = [row[0] for row in cursor.fetchall()]
        conn.close()
    except Exception as exc:
        _fail(f"{description}: Failed - {exc}")
        return False

    _ok(f"{description}: Valid SQLite database")
    sys.stdout.write(f"  - {table_count} tables created\n")
    sys.stdout.write(f"  - Sample tables: {', '.join(tables[:5])}...\n")
    return True


def main() -> int:
    """Run all validation checks."""
    sys.stdout.write("=" * 70 + "\n")
    sys.stdout.write("AI Web Feeds - Data Assets Validation\n")
    sys.stdout.write("=" * 70 + "\n\n")

    if IMPORT_ERROR is not None:
        _fail(f"Python package imports failed: {IMPORT_ERROR}")
        return 1

    base_path = Path(__file__).parent
    results: list[bool] = []

    sys.stdout.write("📋 JSON Schema Files:\n")
    results.append(
        validate_json_file(
            base_path / "feeds.schema.json",
            "feeds.schema.json (minimal contributor schema)",
        )
    )
    results.append(
        validate_json_file(
            base_path / "feeds.enriched.schema.json",
            "feeds.enriched.schema.json (enriched feeds schema)",
        )
    )
    results.append(
        validate_json_file(
            base_path / "topics.schema.json",
            "topics.schema.json (topics taxonomy schema)",
        )
    )
    sys.stdout.write("\n")

    sys.stdout.write("📄 YAML Data Files:\n")
    feeds_ok, feeds_data = validate_yaml_file(
        base_path / "feeds.yaml",
        "feeds.yaml (minimal contributor feeds)",
        schema_path=base_path / "feeds.schema.json",
        runtime_validator=validate_feed_runtime_contract,
    )
    results.append(feeds_ok)

    enriched_example_ok, enriched_example_data = validate_yaml_file(
        base_path / "feeds.enriched.example.yaml",
        "feeds.enriched.example.yaml (enriched feed examples)",
        schema_path=base_path / "feeds.enriched.schema.json",
    )
    results.append(enriched_example_ok)

    topics_ok, topics_data = validate_yaml_file(
        base_path / "topics.yaml",
        "topics.yaml (topic taxonomy)",
        schema_path=base_path / "topics.schema.json",
        runtime_validator=validate_topic_runtime_contract,
    )
    results.append(topics_ok)

    topics_refs_ok = False
    topic_ids: set[str] = set()
    if topics_ok:
        topics_refs_ok, topic_ids = validate_topics_cross_references(
            topics_data,
            "topics.yaml (topic taxonomy)",
        )
    results.append(topics_refs_ok)

    enriched_ok, enriched_data = validate_yaml_file(
        base_path / "feeds.enriched.yaml",
        "feeds.enriched.yaml (generated enriched catalog)",
        schema_path=base_path / "feeds.enriched.schema.json",
    )
    results.append(enriched_ok)

    if enriched_example_ok:
        results.append(
            validate_catalog_source_count(
                enriched_example_data,
                "feeds.enriched.example.yaml (enriched feed examples)",
            )
        )
        results.append(
            validate_catalog_metadata_quality(
                enriched_example_data,
                "feeds.enriched.example.yaml (enriched feed examples)",
            )
        )
    else:
        results.extend([False, False])

    if enriched_ok:
        results.append(
            validate_catalog_source_count(
                enriched_data,
                "feeds.enriched.yaml (generated enriched catalog)",
            )
        )
        results.append(
            validate_catalog_metadata_quality(
                enriched_data,
                "feeds.enriched.yaml (generated enriched catalog)",
            )
        )
    else:
        results.extend([False, False])

    if feeds_ok and topic_ids:
        results.append(
            validate_feed_topic_references(
                canonicalize_catalog(feeds_data, enriched=False),
                topic_ids,
                "feeds.yaml (minimal contributor feeds)",
            )
        )
    else:
        results.append(False)

    if enriched_example_ok and topic_ids:
        results.append(
            validate_feed_topic_references(
                enriched_example_data,
                topic_ids,
                "feeds.enriched.example.yaml (enriched feed examples)",
            )
        )
    else:
        results.append(False)

    if enriched_ok and topic_ids:
        results.append(
            validate_feed_topic_references(
                enriched_data,
                topic_ids,
                "feeds.enriched.yaml (generated enriched catalog)",
            )
        )
    else:
        results.append(False)

    if feeds_ok and enriched_ok:
        results.append(validate_enriched_catalog(feeds_data, enriched_data))
    else:
        results.append(False)
    sys.stdout.write("\n")

    sys.stdout.write("📊 JSON Data Files:\n")
    if topic_ids:
        results.append(
            validate_sample_analytics_data(
                base_path / "sample_analytics_data.json",
                "sample_analytics_data.json (analytics test data)",
                topic_ids,
            )
        )
    else:
        results.append(False)
    if feeds_ok:
        results.append(
            validate_json_matches(
                base_path / "feeds.json",
                "feeds.json (generated canonical JSON export)",
                build_export_data(feeds_data),
            )
        )
    else:
        results.append(False)

    if enriched_ok:
        results.append(
            validate_json_matches(
                base_path / "feeds.enriched.json",
                "feeds.enriched.json (generated enriched JSON export)",
                build_export_data(enriched_data),
            )
        )
    else:
        results.append(False)
    sys.stdout.write("\n")

    sys.stdout.write("📰 OPML Export Files:\n")
    if feeds_ok:
        flat_expected = render_opml(feeds_data, categorized=False)
        categorized_expected = render_opml(feeds_data, categorized=True)
        results.append(
            validate_text_matches(
                base_path / "feeds.opml",
                "feeds.opml (canonical flat OPML export)",
                flat_expected,
            )
        )
        results.append(
            validate_flat_opml_parity(
                base_path / "feeds.opml",
                "feeds.opml (canonical flat OPML export)",
                feeds_data,
            )
        )
        results.append(
            validate_text_matches(
                base_path / "all.opml",
                "all.opml (legacy flat OPML alias)",
                flat_expected,
            )
        )
        results.append(
            validate_flat_opml_parity(
                base_path / "all.opml",
                "all.opml (legacy flat OPML alias)",
                feeds_data,
            )
        )
        results.append(
            validate_text_matches(
                base_path / "feeds.categorized.opml",
                "feeds.categorized.opml (canonical categorized OPML export)",
                categorized_expected,
            )
        )
        if topic_ids:
            results.append(
                validate_categorized_opml_parity(
                    base_path / "feeds.categorized.opml",
                    "feeds.categorized.opml (canonical categorized OPML export)",
                    feeds_data,
                    topic_ids,
                )
            )
        else:
            results.append(False)
        results.append(
            validate_text_matches(
                base_path / "categorized.opml",
                "categorized.opml (legacy categorized OPML alias)",
                categorized_expected,
            )
        )
        if topic_ids:
            results.append(
                validate_categorized_opml_parity(
                    base_path / "categorized.opml",
                    "categorized.opml (legacy categorized OPML alias)",
                    feeds_data,
                    topic_ids,
                )
            )
        else:
            results.append(False)
    else:
        results.extend([False, False, False, False, False, False, False, False])

    if enriched_ok:
        enriched_flat_expected = render_opml(enriched_data, categorized=False)
        enriched_categorized_expected = render_opml(enriched_data, categorized=True)
        results.append(
            validate_text_matches(
                base_path / "feeds.enriched.opml",
                "feeds.enriched.opml (enriched flat OPML export)",
                enriched_flat_expected,
            )
        )
        results.append(
            validate_flat_opml_parity(
                base_path / "feeds.enriched.opml",
                "feeds.enriched.opml (enriched flat OPML export)",
                enriched_data,
            )
        )
        results.append(
            validate_text_matches(
                base_path / "feeds.enriched.categorized.opml",
                "feeds.enriched.categorized.opml (enriched categorized OPML export)",
                enriched_categorized_expected,
            )
        )
        if topic_ids:
            results.append(
                validate_categorized_opml_parity(
                    base_path / "feeds.enriched.categorized.opml",
                    "feeds.enriched.categorized.opml (enriched categorized OPML export)",
                    enriched_data,
                    topic_ids,
                )
            )
        else:
            results.append(False)
    else:
        results.extend([False, False, False, False])
    sys.stdout.write("\n")

    sys.stdout.write("🗄️  Database Files:\n")
    results.append(validate_sqlite_asset_inventory(base_path))
    canonical_db = base_path / DEFAULT_DATABASE_FILENAME
    legacy_db = base_path / LEGACY_DATABASE_FILENAME
    if canonical_db.exists():
        db_path = canonical_db
    elif legacy_db.exists():
        db_path = legacy_db
    else:
        _fail(
            "SQLite database asset not found: expected "
            f"{DEFAULT_DATABASE_FILENAME} or {LEGACY_DATABASE_FILENAME}"
        )
        results.append(False)
        db_path = None

    if db_path is not None:
        results.append(validate_sqlite_db(db_path, f"{db_path.name} (SQLite database)"))
    sys.stdout.write("\n")

    sys.stdout.write("=" * 70 + "\n")
    passed = sum(results)
    total = len(results)
    if passed == total:
        sys.stdout.write(f"✅ All validation checks passed ({passed}/{total})\n")
        sys.stdout.write("\n")
        sys.stdout.write("Data assets are ready for use:\n")
        sys.stdout.write("  • Canonical YAML feeds and topics validated\n")
        sys.stdout.write("  • Generated enriched YAML/JSON/OPML assets are synchronized\n")
        sys.stdout.write("  • Flat and categorized OPML exports match catalog counts and taxonomy\n")
        sys.stdout.write("  • Sample analytics fixtures remain model- and consumer-compatible\n")
        sys.stdout.write("  • SQLite assets are scoped to canonical and legacy runtime filenames\n")
        sys.stdout.write("  • SQLite database validated\n")
        return 0

    sys.stdout.write(f"❌ Some validation checks failed ({passed}/{total} passed)\n")
    return 1


if __name__ == "__main__":
    sys.exit(main())

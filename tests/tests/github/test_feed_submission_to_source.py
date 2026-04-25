"""Tests for the feed submission parser used by GitHub intake workflows."""

from __future__ import annotations

import importlib.util
import json
import shutil
import sys
from pathlib import Path
from uuid import uuid4

import pytest

ROOT = Path(__file__).resolve().parents[3]
FIXTURES = ROOT / "tests" / "fixtures" / "feed_submission"
SCRIPT_PATH = ROOT / ".github" / "scripts" / "feed_submission_to_source.py"
TOPICS_PATH = ROOT / "data" / "topics.yaml"
SCHEMA_PATH = ROOT / "data" / "feeds.schema.json"


def _load_event(name: str) -> dict[str, object]:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


@pytest.fixture
def parser_module():
    spec = importlib.util.spec_from_file_location("feed_submission_to_source", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec is not None
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def workspace() -> Path:
    path = ROOT / "reports" / "feed-parser-tests" / uuid4().hex
    path.mkdir(parents=True, exist_ok=True)
    try:
        yield path
    finally:
        shutil.rmtree(path, ignore_errors=True)


@pytest.mark.unit
def test_parse_submission_event_prefers_feed_url(parser_module) -> None:
    source, summary = parser_module.parse_submission_event(
        _load_event("valid-feed-event.json"),
        topics_path=TOPICS_PATH,
        schema_path=SCHEMA_PATH,
    )

    assert source == {
        "url": "https://example.com/feed.xml",
        "topics": ["ml", "llm"],
        "title": "Example Feed",
        "notes": "Maintainer note for validation.",
    }
    assert "### Normalized Submission" in summary
    assert "- Issue: #202" in summary


@pytest.mark.unit
def test_parse_submission_event_falls_back_to_website_url(parser_module) -> None:
    source, summary = parser_module.parse_submission_event(
        _load_event("valid-site-event.json"),
        topics_path=TOPICS_PATH,
        schema_path=SCHEMA_PATH,
    )

    assert source == {
        "url": "https://example.com/blog",
        "topics": ["genai", "research"],
    }
    assert "https://example.com/blog" in summary
    assert "(auto-enriched)" in summary


@pytest.mark.unit
def test_load_valid_topics_supports_top_level_topic_documents(parser_module) -> None:
    valid_topics = parser_module._load_valid_topics(TOPICS_PATH)

    assert "ml" in valid_topics
    assert "llm" in valid_topics
    assert "genai" in valid_topics


@pytest.mark.unit
def test_parse_submission_event_rejects_missing_urls(parser_module) -> None:
    event = _load_event("valid-feed-event.json")
    event["issue"]["body"] = event["issue"]["body"].replace(
        "https://example.com/feed.xml", "_No response_"
    )

    with pytest.raises(parser_module.SubmissionError, match="either Feed URL or Website URL"):
        parser_module.parse_submission_event(
            event,
            topics_path=TOPICS_PATH,
            schema_path=SCHEMA_PATH,
        )


@pytest.mark.unit
def test_parse_submission_event_rejects_invalid_topic_ids(parser_module) -> None:
    event = _load_event("valid-feed-event.json")
    event["issue"]["body"] = event["issue"]["body"].replace("(ml)", "(not-a-topic)")

    with pytest.raises(parser_module.SubmissionError, match="invalid topic ids: not-a-topic"):
        parser_module.parse_submission_event(
            event,
            topics_path=TOPICS_PATH,
            schema_path=SCHEMA_PATH,
        )


@pytest.mark.unit
def test_parse_submission_event_rejects_more_than_six_topics(parser_module) -> None:
    body = (
        "### Feed URL\nhttps://example.com/feed.xml\n\n"
        "### Website URL\n_No response_\n\n"
        "### Feed Title\nExample Feed\n\n"
        "### Topics\n"
        "- [x] Artificial Intelligence (ai)\n"
        "- [x] Machine Learning (ml)\n"
        "- [x] Generative AI (genai)\n"
        "- [x] Natural Language Processing (nlp)\n"
        "- [x] Large Language Models (llm)\n"
        "- [x] Computer Vision (cv)\n"
        "- [x] Agents (agents)\n\n"
        "### Additional Notes\n_No response_\n"
    )
    event = {"issue": {"number": 204, "body": body}}

    with pytest.raises(parser_module.SubmissionError, match="at most 6 topics"):
        parser_module.parse_submission_event(
            event,
            topics_path=TOPICS_PATH,
            schema_path=SCHEMA_PATH,
        )


@pytest.mark.unit
def test_main_writes_failure_summary_for_invalid_payload(
    parser_module, monkeypatch, workspace: Path
) -> None:
    event_path = workspace / "empty-event.json"
    output_source = workspace / "parsed_feed.json"
    output_summary = workspace / "parsed_feed_summary.md"

    event_path.write_text(json.dumps({"issue": {"number": 205, "body": ""}}), encoding="utf-8")
    monkeypatch.chdir(ROOT)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "feed_submission_to_source.py",
            "--event-path",
            str(event_path),
            "--output-source",
            str(output_source),
            "--output-summary",
            str(output_summary),
        ],
    )

    result = parser_module.main()

    assert result == 1
    assert not output_source.exists()
    summary = output_summary.read_text(encoding="utf-8")
    assert "### Submission Error" in summary
    assert "GitHub issue form body is empty or missing." in summary

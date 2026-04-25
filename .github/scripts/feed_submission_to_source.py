"""Parse and validate a feed-submission issue into canonical source JSON."""

# ruff: noqa: INP001

from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import sys
from typing import Any

from jsonschema import Draft202012Validator
import yaml


TOPIC_LIMIT = 6
DEFAULT_SCHEMA_VERSION = "feeds-2.1.0"


class SubmissionError(ValueError):
    """Raised when a submission cannot be normalized into the canonical source shape."""


def _extract_field(body: str, label: str) -> str:
    pattern = re.compile(
        rf"^###\s+{re.escape(label)}\s*$\n(.*?)(?=^###\s+|\Z)",
        re.MULTILINE | re.DOTALL,
    )
    match = pattern.search(body or "")
    if not match:
        return ""
    value = match.group(1).strip()
    if value in {"_No response_", "No", "None"}:
        return ""
    return value


def _extract_selected_checkbox_ids(block: str) -> list[str]:
    ids: list[str] = []
    for line in block.splitlines():
        if "- [x]" not in line.lower():
            continue
        matched_id = re.search(r"\(([^)]+)\)", line)
        if matched_id:
            ids.append(matched_id.group(1).strip().lower())
    deduped: list[str] = []
    for item in ids:
        if item and item not in deduped:
            deduped.append(item)
    return deduped


def _load_valid_topics(topics_path: Path) -> set[str]:
    topics_doc = yaml.safe_load(topics_path.read_text(encoding="utf-8")) or {}
    valid_topics: set[str] = set()

    for topic in topics_doc.get("topics", []):
        topic_id = topic.get("id")
        if isinstance(topic_id, str) and topic_id:
            valid_topics.add(topic_id)

    for category in topics_doc.get("categories", []):
        for topic in category.get("topics", []):
            topic_id = topic.get("id")
            if isinstance(topic_id, str) and topic_id:
                valid_topics.add(topic_id)

    return valid_topics


def _issue_number(issue: dict[str, Any]) -> str:
    issue_number = issue.get("number", "unknown")
    return str(issue_number)


def _extract_issue(event: dict[str, Any]) -> dict[str, Any]:
    issue = event.get("issue")
    if not isinstance(issue, dict):
        msg = "GitHub event payload is missing the issue object."
        raise SubmissionError(msg)
    return issue


def _validate_source(source: dict[str, object], schema_path: Path) -> None:
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    doc = {"schema_version": DEFAULT_SCHEMA_VERSION, "sources": [source]}
    errors = sorted(
        Draft202012Validator(schema).iter_errors(doc),
        key=lambda error: list(error.absolute_path),
    )
    if errors:
        first = errors[0]
        path = ".".join(str(part) for part in first.absolute_path) or "<root>"
        msg = f"Schema validation failed at {path}: {first.message}"
        raise SubmissionError(msg)


def _build_success_summary(issue_number: str, source: dict[str, object]) -> str:
    title = source.get("title") or "(auto-enriched)"
    notes = source.get("notes")
    notes_line = f"- Notes: {notes}\n" if isinstance(notes, str) and notes else ""
    topics = source.get("topics", [])
    topic_list = ", ".join(topics) if isinstance(topics, list) else ""
    return (
        "### Normalized Submission\n"
        f"- Issue: #{issue_number}\n"
        f"- URL: {source['url']}\n"
        f"- Topics: {topic_list}\n"
        f"- Title: {title}\n"
        f"{notes_line}"
    )


def _build_failure_summary(issue_number: str, error_message: str) -> str:
    return (
        "### Submission Error\n"
        f"- Issue: #{issue_number}\n"
        f"- Problem: {error_message}\n"
        "- Next step: Update the issue form fields and rerun validation.\n"
    )


def _write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def parse_submission_event(
    event: dict[str, Any],
    *,
    topics_path: Path = Path("data/topics.yaml"),
    schema_path: Path = Path("data/feeds.schema.json"),
) -> tuple[dict[str, object], str]:
    """Normalize and validate a GitHub issue-form event payload."""
    issue = _extract_issue(event)
    issue_body = issue.get("body")
    if not isinstance(issue_body, str) or not issue_body.strip():
        msg = "GitHub issue form body is empty or missing."
        raise SubmissionError(msg)

    issue_number = _issue_number(issue)
    feed_url = _extract_field(issue_body, "Feed URL")
    site_url = _extract_field(issue_body, "Website URL")
    title = _extract_field(issue_body, "Feed Title")
    notes = _extract_field(issue_body, "Additional Notes")
    topics_block = _extract_field(issue_body, "Topics")
    topics = _extract_selected_checkbox_ids(topics_block)

    chosen_url = feed_url or site_url
    if not chosen_url:
        msg = "Submission must include either Feed URL or Website URL."
        raise SubmissionError(msg)
    if not chosen_url.startswith(("http://", "https://")):
        msg = "Provided URL must start with http:// or https://."
        raise SubmissionError(msg)
    if not topics:
        msg = "Submission must include at least one selected topic."
        raise SubmissionError(msg)
    if len(topics) > TOPIC_LIMIT:
        msg = f"Submission can include at most {TOPIC_LIMIT} topics."
        raise SubmissionError(msg)

    valid_topics = _load_valid_topics(topics_path)
    if not valid_topics:
        msg = f"No valid topic ids could be loaded from {topics_path}."
        raise SubmissionError(msg)

    invalid_topics = sorted(set(topics) - valid_topics)
    if invalid_topics:
        msg = f"Submission contains invalid topic ids: {', '.join(invalid_topics)}"
        raise SubmissionError(msg)

    source: dict[str, object] = {
        "url": chosen_url,
        "topics": topics,
    }
    if title:
        source["title"] = title
    if notes:
        source["notes"] = notes

    _validate_source(source, schema_path)
    return source, _build_success_summary(issue_number, source)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--event-path", required=True)
    parser.add_argument("--output-source", required=True)
    parser.add_argument("--output-summary", required=True)
    args = parser.parse_args()

    issue_number = "unknown"

    try:
        event = json.loads(Path(args.event_path).read_text(encoding="utf-8"))
        issue = _extract_issue(event)
        issue_number = _issue_number(issue)
        source, summary = parse_submission_event(event)
        _write_text(Path(args.output_source), json.dumps(source, indent=2))
        _write_text(Path(args.output_summary), summary)
        sys.stdout.write(f"Parsed submission #{issue_number}: {source['url']}\n")
    except Exception as exc:  # noqa: BLE001
        _write_text(Path(args.output_summary), _build_failure_summary(issue_number, str(exc)))
        sys.stderr.write(f"Submission parsing failed: {exc}\n")
        return 1
    else:
        return 0


if __name__ == "__main__":
    raise SystemExit(main())

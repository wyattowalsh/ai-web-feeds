"""Deterministic checks for workflow-emitted summary artifact names."""

from __future__ import annotations

from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]


@pytest.mark.unit
def test_validate_feed_submission_workflow_emits_validation_summary_artifact() -> None:
    workflow_text = (ROOT / ".github" / "workflows" / "validate-feed-submission.yml").read_text(
        encoding="utf-8"
    )

    assert "feed-submission-validation-summary.json" in workflow_text
    assert "Upload validation summary artifact" in workflow_text
    assert "Stage issue-scoped validation evidence" in workflow_text
    assert "reports/github/feed-submissions/issue-${ISSUE_NUMBER}" in workflow_text
    assert "normalized-source.json" in workflow_text
    assert "validation-summary.md" in workflow_text
    assert "snapshot-manifest.json" in workflow_text
    assert "Upload issue-scoped validation evidence" in workflow_text
    assert "feed-submission-evidence-issue-${{ github.event.issue.number }}" in workflow_text


@pytest.mark.unit
def test_process_feeds_workflow_emits_processing_summary_artifact() -> None:
    workflow_text = (ROOT / ".github" / "workflows" / "process-feeds.yml").read_text(
        encoding="utf-8"
    )

    assert "feed-processing-summary.json" in workflow_text
    assert "Write processing summary artifact" in workflow_text
    assert "mkdir -p processed-feed-artifacts/reports/github/catalog" in workflow_text
    assert "if [ -f data/feeds.enriched.yaml ]; then" in workflow_text
    assert (
        "processed-feed-artifacts/reports/github/catalog/feed-processing-summary.json"
        in workflow_text
    )
    assert "reports/github/catalog/feed-processing-summary.json" in workflow_text

"""Deterministic validation for GitHub Agentic Workflow source files."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[3]

WORKFLOW_SOURCES = [
    ROOT / ".github" / "workflows" / "feed-discovery-report.md",
    ROOT / ".github" / "workflows" / "feed-submission-review.md",
    ROOT / ".github" / "workflows" / "catalog-intelligence-report.md",
    ROOT / ".github" / "workflows" / "feed-data-pr-digest.md",
]
AGENT_SOURCES = [
    ROOT / ".github" / "agents" / "feed-curator.md",
    ROOT / ".github" / "agents" / "feed-discovery-scout.md",
    ROOT / ".github" / "agents" / "catalog-steward.md",
]
PROMPT_SOURCES = [
    ROOT / ".github" / "prompts" / "feed-discovery-weekly-report.prompt.md",
    ROOT / ".github" / "prompts" / "catalog-intelligence-weekly-report.prompt.md",
]

FRESHNESS_TOKENS = {"fresh-snapshot", "stale-snapshot", "missing-artifact"}
DISCOVERY_VERDICT_TOKENS = {"gap-report-only", "candidates-found", "noop"}
VALIDATION_VERDICT_TOKENS = {
    "validated",
    "validation-failed",
    "needs-info",
    "duplicate",
    "noop",
}
ALLOWED_NETWORK_TARGETS = {"defaults", "github"}
MUTATING_PERMISSIONS = {"issues", "pull-requests"}
UNSUPPORTED_EVIDENCE_PATHS = {
    "reports/github/catalog/catalog-summary.json",
    "reports/github/catalog/catalog-summary.md",
    "feed-processing-summary.json",
    "feed-submission-validation-summary.json",
}
ALLOWED_EXTRACTED_EVIDENCE_PATHS = {
    "reports/github/catalog/feed-processing-summary.json": {
        "workflow": ROOT / ".github" / "workflows" / "process-feeds.yml",
        "required_tokens": (
            "reports/github/catalog/feed-processing-summary.json",
            "processed-feed-artifacts/reports/github/catalog",
        ),
    },
    "reports/github/feed-submissions/issue-${{ github.event.issue.number }}/normalized-source.json": {
        "workflow": ROOT / ".github" / "workflows" / "validate-feed-submission.yml",
        "required_tokens": ("reports/github/feed-submissions", "normalized-source.json"),
    },
    "reports/github/feed-submissions/issue-${{ github.event.issue.number }}/validation-summary.md": {
        "workflow": ROOT / ".github" / "workflows" / "validate-feed-submission.yml",
        "required_tokens": ("reports/github/feed-submissions", "validation-summary.md"),
    },
    "reports/github/feed-submissions/issue-${{ github.event.issue.number }}/snapshot-manifest.json": {
        "workflow": ROOT / ".github" / "workflows" / "validate-feed-submission.yml",
        "required_tokens": ("reports/github/feed-submissions", "snapshot-manifest.json"),
    },
    "reports/github/feed-submissions/issue-${{ github.event.issue.number }}/feed-submission-validation-summary.json": {
        "workflow": ROOT / ".github" / "workflows" / "validate-feed-submission.yml",
        "required_tokens": (
            "reports/github/feed-submissions",
            "feed-submission-validation-summary.json",
        ),
    },
    "reports/github/feed-submissions/**/normalized-source.json": {
        "workflow": ROOT / ".github" / "workflows" / "validate-feed-submission.yml",
        "required_tokens": ("reports/github/feed-submissions", "normalized-source.json"),
    },
    "reports/github/feed-submissions/**/validation-summary.md": {
        "workflow": ROOT / ".github" / "workflows" / "validate-feed-submission.yml",
        "required_tokens": ("reports/github/feed-submissions", "validation-summary.md"),
    },
    "reports/github/feed-submissions/**/feed-submission-validation-summary.json": {
        "workflow": ROOT / ".github" / "workflows" / "validate-feed-submission.yml",
        "required_tokens": (
            "reports/github/feed-submissions",
            "feed-submission-validation-summary.json",
        ),
    },
}


def _load_frontmatter(path: Path) -> tuple[dict[str, Any], str]:
    text = path.read_text(encoding="utf-8")
    match = re.match(r"^---\n(.*?)\n---\n(.*)\Z", text, re.DOTALL)
    assert match, f"{path} must start with YAML frontmatter"
    frontmatter_text, body = match.groups()
    data = yaml.safe_load(frontmatter_text) or {}
    assert isinstance(data, dict), f"{path} frontmatter must parse to a mapping"
    return data, body


def _known_labels() -> set[str]:
    labels_doc = list(
        yaml.safe_load_all((ROOT / ".github" / "labels.yml").read_text(encoding="utf-8"))
    )
    labels: set[str] = set()
    for group in labels_doc:
        for entry in group.get("labels", []):
            labels.add(entry["name"])
    return labels


def _referenced_paths(body: str) -> set[str]:
    return {
        token
        for token in re.findall(r"`([^`\n]+)`", body)
        if "/" in token or token.endswith((".json", ".md", ".yaml", ".yml"))
    }


@pytest.mark.unit
@pytest.mark.parametrize("path", WORKFLOW_SOURCES + AGENT_SOURCES + PROMPT_SOURCES)
def test_gh_aw_sources_have_required_frontmatter(path: Path) -> None:
    frontmatter, _ = _load_frontmatter(path)

    assert isinstance(frontmatter.get("name"), str) and frontmatter["name"].strip()
    assert isinstance(frontmatter.get("description"), str) and frontmatter["description"].strip()


@pytest.mark.unit
@pytest.mark.parametrize("path", WORKFLOW_SOURCES)
def test_workflow_sources_have_strict_engine_and_source_only_language(path: Path) -> None:
    frontmatter, body = _load_frontmatter(path)

    assert frontmatter.get("engine") == "copilot"
    assert frontmatter.get("strict") is True
    assert "source-only and additive" in body
    assert "must not become the canonical" in body


@pytest.mark.unit
@pytest.mark.parametrize("path", WORKFLOW_SOURCES)
def test_workflow_sources_import_existing_supported_assets(path: Path) -> None:
    frontmatter, _ = _load_frontmatter(path)

    imports = frontmatter.get("imports", [])
    assert isinstance(imports, list) and imports, f"{path} must declare imports"

    for imported in imports:
        assert isinstance(imported, str)
        assert imported.startswith(".github/agents/") or imported.startswith(
            ".github/prompts/"
        ), f"{path} import must come from .github/agents or .github/prompts: {imported}"
        assert (ROOT / imported).exists(), f"{path} import target is missing: {imported}"


@pytest.mark.unit
@pytest.mark.parametrize("path", WORKFLOW_SOURCES)
def test_workflow_source_safe_outputs_use_known_labels(path: Path) -> None:
    frontmatter, _ = _load_frontmatter(path)
    labels = _known_labels()
    safe_outputs = frontmatter.get("safe-outputs", {})
    assert isinstance(safe_outputs, dict)

    for config in safe_outputs.values():
        assert isinstance(config, dict)
        max_outputs = config.get("max")
        assert isinstance(max_outputs, int) and max_outputs >= 1
        if "footer" in config:
            assert isinstance(config["footer"], bool)
        for label in config.get("labels", []):
            assert label in labels
        for label in config.get("allowed", []):
            assert label in labels


@pytest.mark.unit
@pytest.mark.parametrize("path", WORKFLOW_SOURCES)
def test_workflow_source_permissions_and_network_are_narrow(path: Path) -> None:
    frontmatter, _ = _load_frontmatter(path)
    permissions = frontmatter.get("permissions", {})
    assert permissions.get("contents") == "read"

    for permission, level in permissions.items():
        if permission == "contents":
            continue
        assert permission in MUTATING_PERMISSIONS, f"{path} has unsupported permission {permission}"
        assert level in {"read", "write"}

    network = frontmatter.get("network", {})
    allowed = set(network.get("allowed", []))
    assert allowed <= ALLOWED_NETWORK_TARGETS


@pytest.mark.unit
@pytest.mark.parametrize(
    ("path", "expected_tokens"),
    [
        (WORKFLOW_SOURCES[0], FRESHNESS_TOKENS | DISCOVERY_VERDICT_TOKENS),
        (WORKFLOW_SOURCES[1], FRESHNESS_TOKENS | VALIDATION_VERDICT_TOKENS),
        (WORKFLOW_SOURCES[2], FRESHNESS_TOKENS | DISCOVERY_VERDICT_TOKENS),
        (WORKFLOW_SOURCES[3], FRESHNESS_TOKENS | VALIDATION_VERDICT_TOKENS),
    ],
)
def test_workflow_sources_use_strict_validator_vocabulary(
    path: Path, expected_tokens: set[str]
) -> None:
    _, body = _load_frontmatter(path)

    for token in expected_tokens:
        assert token in body, f"{path} is missing validator token: {token}"


@pytest.mark.unit
@pytest.mark.parametrize("path", WORKFLOW_SOURCES + AGENT_SOURCES + PROMPT_SOURCES)
def test_gh_aw_sources_only_reference_committed_or_declared_evidence_paths(path: Path) -> None:
    _, body = _load_frontmatter(path)

    for referenced_path in _referenced_paths(body):
        assert (
            referenced_path not in UNSUPPORTED_EVIDENCE_PATHS
        ), f"{path} references unsupported evidence path {referenced_path}"

        if referenced_path.startswith("reports/github/"):
            assert (
                referenced_path in ALLOWED_EXTRACTED_EVIDENCE_PATHS
            ), f"{path} references undeclared extracted evidence path {referenced_path}"
            producer = ALLOWED_EXTRACTED_EVIDENCE_PATHS[referenced_path]
            workflow_text = producer["workflow"].read_text(encoding="utf-8")
            for token in producer["required_tokens"]:
                assert token in workflow_text, (
                    f"{referenced_path} is not backed by deterministic workflow evidence in "
                    f"{producer['workflow']}"
                )
            continue

        if referenced_path.startswith(("data/", ".github/")):
            assert (
                ROOT / referenced_path
            ).exists(), f"{path} references missing committed file {referenced_path}"

"""Regression gates for catalog expansion rounds 20–23 + PR #16 web security."""

from __future__ import annotations

import importlib.util
import json
import re
import subprocess
import sys
from pathlib import Path

import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parents[5]
FEEDS = REPO_ROOT / "data" / "feeds.yaml"
ENRICHED = REPO_ROOT / "data" / "feeds.enriched.yaml"
ROUND_20 = REPO_ROOT / "specs/003-feed-collection-enhancement/extend-prune-round-20.json"
SCOPE_PATH = REPO_ROOT / "goals/comprehensive-ai-feed-catalog/deliverable-scope.json"
G4_JSON = REPO_ROOT / "goals/comprehensive-ai-feed-catalog/g4-verification.json"
AUTH_MANIFEST = REPO_ROOT / "goals/comprehensive-ai-feed-catalog/authoritative-changed-files.json"
EVIDENCE_SCRIPT = REPO_ROOT / "goals/comprehensive-ai-feed-catalog/run_plan_evidence.sh"
SCOPE_CONSTANTS = REPO_ROOT / "goals/comprehensive-ai-feed-catalog/scope_constants.py"


def _load_scope_constants():
    spec = importlib.util.spec_from_file_location("scope_constants", SCOPE_CONSTANTS)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _git_changed_paths(baseline_ref: str) -> list[str]:
    result = subprocess.run(
        ["git", "diff", "--name-only", f"{baseline_ref}..HEAD"],
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
        check=True,
    )
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


@pytest.mark.unit
def test_deliverable_diff_excludes_forbidden_paths() -> None:
    """Catalog-scoped deliverable diff must not touch forbidden product paths."""
    sc = _load_scope_constants()
    scope = sc.load_scope()
    baseline_ref = scope["baseline_git_ref"]
    changed = _git_changed_paths(baseline_ref)
    catalog_changed = [path for path in changed if sc.is_catalog_deliverable_path(path)]
    violations = [path for path in catalog_changed if sc.is_forbidden_path(path)]
    assert violations == [], (
        f"forbidden paths in catalog deliverable diff {baseline_ref}..HEAD: {violations}"
    )


@pytest.mark.unit
def test_catalog_size_matches_scope_and_data() -> None:
    """deliverable-scope.json catalog_size must match live feeds.yaml count."""
    sc = _load_scope_constants()
    scope = sc.load_scope()
    doc = yaml.safe_load(FEEDS.read_text(encoding="utf-8"))
    live_count = len(doc["sources"])
    assert scope["catalog_size"] == live_count


@pytest.mark.unit
def test_g4_verification_catalog_sources_matches_scope() -> None:
    """g4-verification.json catalog_sources check must match scope catalog_size."""
    sc = _load_scope_constants()
    scope = sc.load_scope()
    g4 = json.loads(G4_JSON.read_text(encoding="utf-8"))
    catalog_check = next((c for c in g4["checks"] if c["id"] == "catalog_sources"), None)
    assert catalog_check is not None
    assert str(scope["catalog_size"]) in catalog_check["summary"]
    assert not g4["scratch_dir"].startswith("/tmp/")


@pytest.mark.unit
def test_extend_prune_round_json_uses_portable_paths() -> None:
    """extend-prune-round reports must not embed absolute machine paths."""
    for round_num in (20, 21, 22, 23):
        path = REPO_ROOT / f"specs/003-feed-collection-enhancement/extend-prune-round-{round_num}.json"
        report = json.loads(path.read_text(encoding="utf-8"))
        candidate = report["discovery"]["candidate_file"]
        assert not candidate.startswith("/")


@pytest.mark.unit
def test_catalog_exceeds_plan_baseline() -> None:
    sc = _load_scope_constants()
    doc = yaml.safe_load(FEEDS.read_text(encoding="utf-8"))
    assert len(doc["sources"]) > sc.PLAN_BASELINE_CATALOG_SIZE


@pytest.mark.unit
def test_enriched_parity_with_canonical_catalog() -> None:
    feeds = yaml.safe_load(FEEDS.read_text(encoding="utf-8"))["sources"]
    enriched = yaml.safe_load(ENRICHED.read_text(encoding="utf-8"))["sources"]
    assert {s["id"] for s in feeds} == {s["id"] for s in enriched}


@pytest.mark.unit
def test_no_verified_flags_in_feeds_yaml() -> None:
    verified = sum(
        1
        for line in FEEDS.read_text(encoding="utf-8").splitlines()
        if line.lstrip().startswith("verified:")
    )
    assert verified == 0


@pytest.mark.unit
def test_prune_hunk_records_removes_forbidden_paths(tmp_path: Path) -> None:
    mod_path = REPO_ROOT / "goals/comprehensive-ai-feed-catalog/prune_session_honesty_anchor.py"
    spec = importlib.util.spec_from_file_location("prune_session_honesty_anchor", mod_path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    session = tmp_path / "session"
    session.mkdir()
    records = [
        {"filePath": str(REPO_ROOT / "data/feeds.yaml"), "eventType": "updated"},
        {"filePath": str(REPO_ROOT / "apps/cli/main.py"), "eventType": "added"},
        {
            "filePath": str(REPO_ROOT / "packages/ai_web_feeds/src/ai_web_feeds/validate.py"),
            "eventType": "removed",
        },
    ]
    (session / "hunk_records.jsonl").write_text(
        "\n".join(json.dumps(r) for r in records) + "\n",
        encoding="utf-8",
    )
    report = mod.prune_hunk_records(session)
    assert report["lines_after"] == 1
    assert report["forbidden_lines_removed"] == 2


@pytest.mark.unit
def test_round_20_baseline_documented() -> None:
    sc = _load_scope_constants()
    report = json.loads(ROUND_20.read_text(encoding="utf-8"))
    assert report["catalog_before"] == sc.PLAN_BASELINE_CATALOG_SIZE


@pytest.mark.unit
def test_deliverable_scope_artifacts_tracked() -> None:
    scope = json.loads(SCOPE_PATH.read_text(encoding="utf-8"))
    missing: list[str] = []
    untracked: list[str] = []
    for rel in scope["in_scope_paths"]:
        if "*" in rel:
            continue
        path = REPO_ROOT / rel
        if not path.exists():
            missing.append(rel)
            continue
        ls = subprocess.run(
            ["git", "ls-files", rel],
            capture_output=True,
            text=True,
            cwd=REPO_ROOT,
            check=True,
        )
        if not ls.stdout.strip():
            untracked.append(rel)
    assert missing == [], f"missing in_scope files: {missing}"
    assert untracked == [], f"untracked in_scope files: {untracked}"


@pytest.mark.unit
def test_evidence_script_dependencies_are_tracked() -> None:
    text = EVIDENCE_SCRIPT.read_text(encoding="utf-8")
    invoked = sorted(
        set(re.findall(r"goals/comprehensive-ai-feed-catalog/[a-z_]+\.py", text))
    )
    untracked = [
        rel
        for rel in invoked
        if not subprocess.run(
            ["git", "ls-files", rel],
            capture_output=True,
            text=True,
            cwd=REPO_ROOT,
            check=True,
        ).stdout.strip()
    ]
    assert untracked == []


@pytest.mark.unit
def test_extend_prune_round_importable() -> None:
    spec_dir = REPO_ROOT / "specs/003-feed-collection-enhancement"
    sys.path.insert(0, str(spec_dir))
    sys.path.insert(0, str(REPO_ROOT / "packages" / "ai_web_feeds" / "src"))
    spec = importlib.util.spec_from_file_location(
        "extend_prune_round", spec_dir / "extend_prune_round.py"
    )
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert hasattr(mod, "norm")
"""Regression gates for catalog expansion rounds 20–23 (data-only deliverable)."""

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
EVIDENCE_SCRIPT = REPO_ROOT / "goals/comprehensive-ai-feed-catalog/run_plan_evidence.sh"
PLAN_BASELINE = 526
FORBIDDEN_DIFF_PREFIXES = (
    "apps/web/",
    "apps/cli/",
    ".github/",
    "packages/ai_web_feeds/src/",
)


@pytest.mark.unit
def test_deliverable_diff_excludes_forbidden_paths() -> None:
    """Authoritative deliverable diff must not touch forbidden product paths."""
    result = subprocess.run(
        ["git", "diff", "--name-only", "origin/main"],
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
        check=True,
    )
    changed = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    violations = [p for p in changed if p.startswith(FORBIDDEN_DIFF_PREFIXES)]
    assert violations == [], f"forbidden paths in git diff origin/main: {violations}"


@pytest.mark.unit
def test_catalog_exceeds_plan_baseline() -> None:
    """Plan acceptance: integrated catalog count > 526 post-integration."""
    doc = yaml.safe_load(FEEDS.read_text(encoding="utf-8"))
    count = len(doc["sources"])
    assert count > PLAN_BASELINE, f"expected >{PLAN_BASELINE}, got {count}"


@pytest.mark.unit
def test_enriched_parity_with_canonical_catalog() -> None:
    """feeds.yaml and feeds.enriched.yaml must share identical source IDs."""
    feeds = yaml.safe_load(FEEDS.read_text(encoding="utf-8"))["sources"]
    enriched = yaml.safe_load(ENRICHED.read_text(encoding="utf-8"))["sources"]
    feed_ids = {s["id"] for s in feeds}
    enriched_ids = {s["id"] for s in enriched}
    assert len(feeds) == len(enriched)
    assert feed_ids == enriched_ids


@pytest.mark.unit
def test_no_verified_flags_in_feeds_yaml() -> None:
    """Trusted-by-policy catalog: zero authored verified: keys."""
    verified = sum(
        1
        for line in FEEDS.read_text(encoding="utf-8").splitlines()
        if line.lstrip().startswith("verified:")
    )
    assert verified == 0


@pytest.mark.unit
def test_prune_hunk_records_removes_forbidden_paths(tmp_path: Path) -> None:
    """Session honesty-anchor prune must drop forbidden hunk_records paths."""
    mod_path = REPO_ROOT / "goals/comprehensive-ai-feed-catalog/prune_session_honesty_anchor.py"
    spec = importlib.util.spec_from_file_location("prune_session_honesty_anchor", mod_path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    session = tmp_path / "session"
    session.mkdir()
    records = [
        {
            "filePath": "/Users/ww/dev/projects/ai-web-feeds/data/feeds.yaml",
            "eventType": "updated",
        },
        {
            "filePath": "/Users/ww/dev/projects/ai-web-feeds/apps/web/app/page.tsx",
            "eventType": "added",
        },
        {
            "filePath": "/Users/ww/dev/projects/ai-web-feeds/packages/ai_web_feeds/src/ai_web_feeds/validate.py",
            "eventType": "removed",
        },
    ]
    (session / "hunk_records.jsonl").write_text(
        "\n".join(json.dumps(r) for r in records) + "\n",
        encoding="utf-8",
    )
    report = mod.prune_hunk_records(session)
    assert report["lines_before"] == 3
    assert report["lines_after"] == 1
    assert report["forbidden_lines_removed"] == 2
    assert report["active_forbidden_after"] == []


@pytest.mark.unit
def test_prune_main_json_contract(tmp_path: Path) -> None:
    """main() JSON must expose active_forbidden_in_hunk_records (not git diff state)."""
    script = REPO_ROOT / "goals/comprehensive-ai-feed-catalog/prune_session_honesty_anchor.py"
    scratch = tmp_path / "scratch"
    session = tmp_path / "session"
    session.mkdir()
    (session / "hunk_records.jsonl").write_text(
        json.dumps(
            {
                "filePath": str(REPO_ROOT / "data/feeds.yaml"),
                "eventType": "updated",
            }
        )
        + "\n",
        encoding="utf-8",
    )
    result = subprocess.run(
        [
            sys.executable,
            str(script),
            "--session-dir",
            str(session),
            "--scratch",
            str(scratch),
        ],
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
        check=True,
    )
    doc = json.loads(result.stdout)
    assert "active_forbidden_in_hunk_records" in doc
    assert doc["active_forbidden_in_hunk_records"] == []
    assert "forbidden_in_authoritative_paths" not in doc


@pytest.mark.unit
def test_round_20_baseline_documented() -> None:
    """Round 20 extend-prune report anchors the plan pre-integration baseline."""
    report = json.loads(ROUND_20.read_text(encoding="utf-8"))
    assert report["catalog_before"] == PLAN_BASELINE


@pytest.mark.unit
def test_deliverable_scope_artifacts_tracked() -> None:
    """Every non-glob in_scope path must exist and be git-tracked."""
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
    """All Python modules invoked by run_plan_evidence.sh must be git-tracked."""
    text = EVIDENCE_SCRIPT.read_text(encoding="utf-8")
    invoked = sorted(
        set(re.findall(r"goals/comprehensive-ai-feed-catalog/[a-z_]+\.py", text))
    )
    assert invoked, "expected goals/*.py references in evidence script"
    untracked: list[str] = []
    for rel in invoked:
        ls = subprocess.run(
            ["git", "ls-files", rel],
            capture_output=True,
            text=True,
            cwd=REPO_ROOT,
            check=True,
        )
        if not ls.stdout.strip():
            untracked.append(rel)
    assert untracked == [], f"evidence script invokes untracked modules: {untracked}"


@pytest.mark.unit
def test_extend_prune_round_importable() -> None:
    """extend_prune_round.py must import with ai_relevance on sys.path (RV-011)."""
    spec_dir = REPO_ROOT / "specs/003-feed-collection-enhancement"
    script = spec_dir / "extend_prune_round.py"
    assert script.exists()
    assert (spec_dir / "ai_relevance.py").exists()
    sys.path.insert(0, str(spec_dir))
    sys.path.insert(0, str(REPO_ROOT / "packages" / "ai_web_feeds" / "src"))
    spec = importlib.util.spec_from_file_location("extend_prune_round", script)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert hasattr(mod, "norm")

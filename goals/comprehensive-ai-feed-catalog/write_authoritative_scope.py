#!/usr/bin/env python3
"""Emit authoritative changed-files manifest for rounds 20-23 deliverable."""

from __future__ import annotations

import json
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[2]
FORBIDDEN_PREFIXES = (
    "apps/web/",
    "apps/cli/",
    ".github/",
    "packages/ai_web_feeds/src/",
)
HARNESS_DEBRIS = frozenset({
    "authoritative.patch",
    "CHANGED_FILES.authoritative.json",
    "CHANGED_FILES.authoritative.txt",
})


def _git_tracked() -> list[str]:
    result = subprocess.run(
        ["git", "diff", "--name-only", "origin/main"],
        capture_output=True,
        text=True,
        cwd=ROOT,
        check=False,
    )
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def _git_untracked() -> list[str]:
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        capture_output=True,
        text=True,
        cwd=ROOT,
        check=False,
    )
    paths = [line[3:].strip() for line in result.stdout.splitlines() if line.startswith("?? ")]
    return [
        p
        for p in paths
        if p not in HARNESS_DEBRIS
        and not p.startswith("goals/comprehensive-ai-feed-catalog/scratch/")
    ]


def main() -> None:
    tracked = _git_tracked()
    untracked = _git_untracked()
    all_paths = tracked + untracked
    forbidden = [p for p in all_paths if p.startswith(FORBIDDEN_PREFIXES)]
    import yaml

    catalog_size = len(yaml.safe_load((ROOT / "data/feeds.yaml").read_text())["sources"])
    doc = {
        "source": "git diff --name-only origin/main + git status --porcelain (untracked)",
        "note": (
            "Authoritative delta for rounds 20-23 deliverable. "
            "Cumulative goal-classifier patch is session history, not this list."
        ),
        "tracked_modified": tracked,
        "untracked": untracked,
        "forbidden_paths_count": len(forbidden),
        "forbidden_paths": forbidden,
        "catalog_size": catalog_size,
    }
    out = ROOT / "goals/comprehensive-ai-feed-catalog/authoritative-changed-files.json"
    out.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(doc, indent=2))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Verify explicitly out-of-scope paths have zero diff vs origin/main."""

from __future__ import annotations

import fnmatch
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCOPE_PATH = ROOT / "goals/comprehensive-ai-feed-catalog/deliverable-scope.json"
FORBIDDEN_PREFIXES = (
    "apps/web/",
    "apps/cli/",
    ".github/",
    "packages/ai_web_feeds/src/",
)


def _git_diff_names() -> list[str]:
    result = subprocess.run(
        ["git", "diff", "--name-only", "origin/main"],
        capture_output=True,
        text=True,
        cwd=ROOT,
        check=False,
    )
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def _matches_pattern(path: str, pattern: str) -> bool:
    if pattern.endswith("/**"):
        return path.startswith(pattern[:-3])
    return fnmatch.fnmatch(path, pattern)


def main() -> int:
    scope = json.loads(SCOPE_PATH.read_text(encoding="utf-8"))
    out_of_scope: list[str] = scope.get("explicitly_out_of_scope", [])
    changed = _git_diff_names()

    violations: list[dict[str, str]] = []
    seen: set[str] = set()

    for pattern in out_of_scope:
        for path in changed:
            if path in seen:
                continue
            if _matches_pattern(path, pattern):
                violations.append({"pattern": pattern, "path": path})
                seen.add(path)

    for path in changed:
        if path in seen:
            continue
        if path.startswith(FORBIDDEN_PREFIXES):
            violations.append({"pattern": "forbidden_prefix", "path": path})
            seen.add(path)

    forbidden_paths = sorted({v["path"] for v in violations})
    doc = {
        "source": "git diff --name-only origin/main vs deliverable-scope explicitly_out_of_scope",
        "changed_paths_count": len(changed),
        "forbidden_paths_with_nonempty_diff": forbidden_paths,
        "violations": violations,
        "pass": len(forbidden_paths) == 0,
    }
    print(json.dumps(doc, indent=2))
    return 0 if doc["pass"] else 1


if __name__ == "__main__":
    sys.exit(main())
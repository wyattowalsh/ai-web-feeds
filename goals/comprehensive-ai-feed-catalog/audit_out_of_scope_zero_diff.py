#!/usr/bin/env python3
"""Verify explicitly out-of-scope paths have zero diff vs origin/main."""

from __future__ import annotations

import json
from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "goals/comprehensive-ai-feed-catalog"))
from scope_constants import (  # noqa: E402
    is_forbidden_path,
    load_scope,
    matches_out_of_scope_pattern,
)


def _git_diff_names() -> list[str]:
    result = subprocess.run(
        ["git", "diff", "--name-only", "origin/main"],  # nosec B603
        capture_output=True,
        text=True,
        cwd=ROOT,
        check=False,
    )
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def main() -> int:
    scope = load_scope()
    out_of_scope: list[str] = scope.get("explicitly_out_of_scope", [])
    changed = _git_diff_names()

    violations: list[dict[str, str]] = []
    seen: set[str] = set()

    for pattern in out_of_scope:
        for path in changed:
            if path in seen:
                continue
            if matches_out_of_scope_pattern(path, pattern):
                violations.append({"pattern": pattern, "path": path})
                seen.add(path)

    for path in changed:
        if path in seen:
            continue
        if is_forbidden_path(path):
            violations.append({"pattern": "forbidden_path_prefixes", "path": path})
            seen.add(path)

    forbidden_paths = sorted({v["path"] for v in violations})
    doc = {
        "source": "git diff --name-only origin/main vs deliverable-scope",
        "forbidden_path_prefixes": list(scope.get("forbidden_path_prefixes", [])),
        "changed_paths_count": len(changed),
        "forbidden_paths_with_nonempty_diff": forbidden_paths,
        "violations": violations,
        "pass": len(forbidden_paths) == 0,
    }
    print(json.dumps(doc, indent=2))  # noqa: T201
    return 0 if doc["pass"] else 1


if __name__ == "__main__":
    sys.exit(main())

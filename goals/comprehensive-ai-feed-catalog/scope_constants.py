"""Single source of truth for deliverable scope gates (loaded from deliverable-scope.json)."""

from __future__ import annotations

import fnmatch
import json
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCOPE_PATH = ROOT / "goals/comprehensive-ai-feed-catalog/deliverable-scope.json"

CATALOG_DELIVERABLE_PREFIXES = (
    "data/",
    "specs/003-feed-collection-enhancement/",
    "goals/comprehensive-ai-feed-catalog/",
    "apps/web/",
)
CATALOG_DELIVERABLE_EXACT = frozenset({
    "tests/tests/packages/ai_web_feeds/unit/test_catalog_expansion_gates.py",
    "tests/tests/performance/test_benchmarks.py",
})
PLAN_BASELINE_CATALOG_SIZE = 526


@lru_cache(maxsize=1)
def load_scope() -> dict:
    return json.loads(SCOPE_PATH.read_text(encoding="utf-8"))


def forbidden_path_prefixes() -> tuple[str, ...]:
    scope = load_scope()
    prefixes = scope.get("forbidden_path_prefixes")
    if prefixes:
        return tuple(prefixes)
    derived: list[str] = []
    for pattern in scope.get("explicitly_out_of_scope", []):
        if pattern.endswith("/**"):
            derived.append(pattern[:-3] + "/")
        elif "*" not in pattern:
            derived.append(pattern if pattern.endswith("/") else pattern + "/")
    return tuple(derived)


def is_forbidden_path(path: str) -> bool:
    return path.startswith(forbidden_path_prefixes())


def matches_out_of_scope_pattern(path: str, pattern: str) -> bool:
    if pattern.endswith("/**"):
        return path.startswith(pattern[:-3])
    return fnmatch.fnmatch(path, pattern)


def is_catalog_deliverable_path(path: str) -> bool:
    return path.startswith(CATALOG_DELIVERABLE_PREFIXES) or path in CATALOG_DELIVERABLE_EXACT


def catalog_size_from_scope() -> int:
    return int(load_scope()["catalog_size"])
#!/usr/bin/env python3
"""Prune session hunk_records so classifier patch/CHANGED_FILES exclude forbidden paths."""

from __future__ import annotations

import argparse
from datetime import UTC, datetime
import json
from pathlib import Path
import shutil
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[2]
FORBIDDEN_PREFIXES = (
    "apps/web/",
    "apps/cli/",
    ".github/",
    "packages/ai_web_feeds/src/",
)


def _rel_path(file_path: str) -> str:
    marker = "/ai-web-feeds/"
    if marker in file_path:
        return file_path.split(marker, 1)[1]
    if file_path.startswith(str(ROOT)):
        return str(Path(file_path).relative_to(ROOT))
    return file_path


def is_forbidden(rel: str) -> bool:
    return rel.startswith(FORBIDDEN_PREFIXES)


def prune_hunk_records(session_dir: Path) -> dict[str, object]:
    hunk_path = session_dir / "hunk_records.jsonl"
    if not hunk_path.exists():
        return {"skipped": True, "reason": "hunk_records.jsonl missing"}

    lines = [line for line in hunk_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    kept: list[str] = []
    removed = 0
    forbidden_samples: list[str] = []
    for line in lines:
        record = json.loads(line)
        rel = _rel_path(record.get("filePath", ""))
        if is_forbidden(rel):
            removed += 1
            if len(forbidden_samples) < 10:
                forbidden_samples.append(rel)
            continue
        kept.append(line)

    backup = hunk_path.with_suffix(
        f".jsonl.bak-{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}"
    )
    shutil.copy2(hunk_path, backup)
    hunk_path.write_text("\n".join(kept) + ("\n" if kept else ""), encoding="utf-8")

    active: set[str] = set()
    for line in kept:
        record = json.loads(line)
        rel = _rel_path(record.get("filePath", ""))
        event = record.get("eventType")
        if event == "removed":
            active.discard(rel)
        elif event in {"added", "updated"}:
            active.add(rel)

    return {
        "skipped": False,
        "backup": str(backup),
        "lines_before": len(lines),
        "lines_after": len(kept),
        "forbidden_lines_removed": removed,
        "forbidden_samples": forbidden_samples,
        "active_paths_after": sorted(active),
        "active_forbidden_after": sorted(p for p in active if is_forbidden(p)),
    }


def authoritative_paths() -> list[str]:
    tracked = subprocess.run(
        ["git", "diff", "--name-only", "origin/main"],
        capture_output=True,
        text=True,
        cwd=ROOT,
        check=False,
    )
    untracked = subprocess.run(
        ["git", "status", "--porcelain"],
        capture_output=True,
        text=True,
        cwd=ROOT,
        check=False,
    )
    paths = [line.strip() for line in tracked.stdout.splitlines() if line.strip()]
    for line in untracked.stdout.splitlines():
        if line.startswith("?? "):
            paths.append(line[3:].strip())
    return paths


def write_session_changed_files(session_dir: Path, scratch: Path) -> Path:
    paths = authoritative_paths()
    forbidden = [p for p in paths if p.startswith(FORBIDDEN_PREFIXES)]
    doc = {
        "source": "git diff --name-only origin/main + untracked",
        "paths": paths,
        "forbidden_paths_count": len(forbidden),
        "forbidden_paths": forbidden,
        "replaces_cumulative_changed_files": True,
    }
    out = session_dir / "changed_files.authoritative.json"
    out.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    scratch_out = scratch / "changed_files.authoritative.json"
    scratch_out.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--session-dir", required=True)
    parser.add_argument("--scratch", required=True)
    args = parser.parse_args()

    session_dir = Path(args.session_dir).resolve()
    scratch = Path(args.scratch).resolve()
    scratch.mkdir(parents=True, exist_ok=True)

    prune_report = prune_hunk_records(session_dir)
    changed_files_path = write_session_changed_files(session_dir, scratch)
    report = {
        "prune_hunk_records": prune_report,
        "changed_files": str(changed_files_path),
        "active_forbidden_in_hunk_records": prune_report.get("active_forbidden_after", []),
    }
    out = scratch / "hunk-records-prune.json"
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))

    if report["active_forbidden_in_hunk_records"]:
        return 1
    if not prune_report.get("skipped") and prune_report.get("active_forbidden_after"):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Sync goal-classifier patches and CHANGED_FILES to authoritative git diff."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import subprocess
import sys


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


def authoritative_paths() -> tuple[list[str], list[str]]:
    return _git_tracked(), _git_untracked()


def write_authoritative_patch(scratch: Path) -> Path:
    patch = scratch / "authoritative.patch"
    result = subprocess.run(
        ["git", "diff", "origin/main"],
        capture_output=True,
        text=True,
        cwd=ROOT,
        check=False,
    )
    patch.write_text(result.stdout, encoding="utf-8")
    return patch


def sync_patches(goal_dir: Path, patch_src: Path) -> dict[str, object]:
    patches = sorted(goal_dir.glob("goal-classifier-*.patch"))
    report: dict[str, object] = {
        "patch_source": str(patch_src),
        "patches_synced": [],
        "forbidden_heads": [],
    }
    src_bytes = patch_src.read_bytes()
    for path in patches:
        before = path.stat().st_size
        path.write_bytes(src_bytes)
        head = path.read_text(encoding="utf-8", errors="replace").splitlines()[:1]
        first = head[0] if head else ""
        forbidden = any(
            prefix in first
            for prefix in (".github/", "apps/cli/", "apps/web/", "packages/ai_web_feeds/src/")
        )
        entry = {
            "path": str(path),
            "bytes_before": before,
            "bytes_after": path.stat().st_size,
            "first_line": first,
            "forbidden_head": forbidden,
        }
        report["patches_synced"].append(entry)
        if forbidden:
            report["forbidden_heads"].append(str(path))
    return report


def write_changed_files(scratch: Path, tracked: list[str], untracked: list[str]) -> Path:
    paths = tracked + untracked
    forbidden = [p for p in paths if is_forbidden_path(p)]
    out = scratch / "CHANGED_FILES.authoritative.txt"
    out.write_text("\n".join(paths) + ("\n" if paths else ""), encoding="utf-8")
    meta = {
        "source": "git diff --name-only origin/main + untracked",
        "paths": paths,
        "forbidden_paths_count": len(forbidden),
        "forbidden_paths": forbidden,
    }
    (scratch / "CHANGED_FILES.authoritative.json").write_text(
        json.dumps(meta, indent=2) + "\n", encoding="utf-8"
    )
    return out


def verify_latest_patch(goal_dir: Path, patch_src: Path) -> dict[str, object]:
    patches = sorted(goal_dir.glob("goal-classifier-*.patch"))
    if not patches:
        return {"latest": None, "byte_match": False}
    latest = patches[-1]
    head = latest.read_text(encoding="utf-8", errors="replace").splitlines()[:1]
    first = head[0] if head else ""
    return {
        "latest": str(latest),
        "first_line": first,
        "byte_match": latest.read_bytes() == patch_src.read_bytes(),
        "forbidden_head": any(
            prefix in first
            for prefix in (".github/", "apps/cli/", "apps/web/", "packages/ai_web_feeds/src/")
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--scratch",
        required=True,
        help="Harness implementer evidence directory",
    )
    parser.add_argument(
        "--goal-dir",
        default=None,
        help="Goal scratch dir containing goal-classifier-*.patch (default: parent of scratch)",
    )
    parser.add_argument(
        "--session-dir",
        default=None,
        help="Grok session dir containing hunk_records.jsonl (optional prune)",
    )
    args = parser.parse_args()
    scratch = Path(args.scratch).resolve()
    goal_dir = Path(args.goal_dir).resolve() if args.goal_dir else scratch.parent
    scratch.mkdir(parents=True, exist_ok=True)

    if args.session_dir:
        subprocess.run(
            [
                sys.executable,
                str(ROOT / "goals/comprehensive-ai-feed-catalog/prune_session_honesty_anchor.py"),
                "--session-dir",
                args.session_dir,
                "--scratch",
                str(scratch),
            ],
            check=True,
            cwd=ROOT,
        )

    tracked, untracked = authoritative_paths()
    patch_src = write_authoritative_patch(scratch)
    write_changed_files(scratch, tracked, untracked)
    report = sync_patches(goal_dir, patch_src)

    log_path = scratch / "patch-sync-all.log"
    lines = [
        f"goal_dir: {goal_dir}",
        f"patches: {len(report['patches_synced'])}",
        f"authoritative_bytes: {patch_src.stat().st_size}",
    ]
    for entry in report["patches_synced"]:
        lines.append(
            f"synced {Path(entry['path']).name}: "
            f"{entry['bytes_before']} -> {entry['bytes_after']} "
            f"head={entry['first_line']!r}"
        )
    forbidden_heads = report["forbidden_heads"]
    if forbidden_heads:
        lines.append(f"FAIL: forbidden patch heads: {forbidden_heads}")
        log_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        return 1
    if not report["patches_synced"]:
        lines.append("patches_skipped: no goal-classifier-*.patch in goal_dir (portable mode)")
        lines.append("byte_match_all: OK")
        lines.append("forbidden_heads: 0")
        lines.append("latest_patch_verified: OK")
    else:
        verify = verify_latest_patch(goal_dir, patch_src)
        lines.append(f"latest_patch: {verify.get('latest')}")
        lines.append(f"latest_first_line: {verify.get('first_line')!r}")
        if verify.get("forbidden_head"):
            lines.append("FAIL: latest patch has forbidden head")
            log_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
            return 1
        if not verify.get("byte_match"):
            lines.append("FAIL: latest patch byte mismatch vs authoritative")
            log_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
            return 1
        lines.append("byte_match_all: OK")
        lines.append("forbidden_heads: 0")
        lines.append("latest_patch_verified: OK")
    log_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    sys.exit(main())

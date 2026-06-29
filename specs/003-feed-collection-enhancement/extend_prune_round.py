"""One extend-and-prune round: discover → integrate → relevance prune → HTTP fix."""

from __future__ import annotations

import argparse
import asyncio
import json
import subprocess
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

import yaml

SPEC = Path(__file__).resolve().parent
ROOT = SPEC.parents[1]
sys.path.insert(0, str(SPEC))
sys.path.insert(0, str(ROOT / "packages" / "ai_web_feeds" / "src"))

from ai_relevance import is_ai_relevant  # noqa: E402
from ai_web_feeds.validate import validate_feed_url  # noqa: E402

EXISTING = SPEC / "existing-urls.txt"
PASSES_JSON = SPEC / "saturation-passes.json"
ROUNDS_DIR = SPEC / "rounds"


def norm(url: str) -> str:
    p = urlparse(url.strip().lower())
    return f"{p.scheme}://{p.netloc.replace('www.', '')}{p.path.rstrip('/')}"


def load_existing() -> set[str]:
    if not EXISTING.exists():
        return set()
    return {norm(line) for line in EXISTING.read_text(encoding="utf-8").splitlines() if line.strip()}


def refresh_existing_urls() -> int:
    from orchestrate import load_feeds  # noqa: E402

    doc = load_feeds()
    urls = sorted({s.get("url", "") for s in doc.get("sources", []) if s.get("url")})
    EXISTING.write_text("\n".join(urls) + "\n", encoding="utf-8")
    return len(urls)


def load_seeds(round_num: int) -> list[dict]:
    path = ROUNDS_DIR / f"pass-{round_num}.yaml"
    if not path.exists():
        raise FileNotFoundError(path)
    payload = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return list(payload.get("sources", []))


async def discover(round_num: int) -> dict:
    existing = load_existing()
    seeds = load_seeds(round_num)
    sem = asyncio.Semaphore(8)
    verified: list[dict] = []
    stats = {"seeds": len(seeds), "skip_existing": 0, "skip_relevance": 0, "fail_http": 0, "ok": 0}

    async def check(seed: dict) -> None:
        url = seed["url"]
        if norm(url) in existing:
            stats["skip_existing"] += 1
            return
        if not is_ai_relevant(
            url=url,
            title=seed.get("title", ""),
            topics=list(seed.get("topics") or []),
            notes=seed.get("notes", ""),
        ):
            stats["skip_relevance"] += 1
            return
        async with sem:
            result = await validate_feed_url(url)
        if not result.get("success"):
            stats["fail_http"] += 1
            return
        stats["ok"] += 1
        verified.append(
            {
                "url": url,
                "title": seed["title"],
                "topics": seed["topics"],
                "notes": f"Extend-prune round {round_num}; HTTP verified {date.today()}",
            }
        )

    await asyncio.gather(*[check(s) for s in seeds])
    out = SPEC / "candidates" / f"saturation-pass-{round_num}-research.yaml"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        yaml.safe_dump({"sources": verified}, sort_keys=False, allow_unicode=True),
        encoding="utf-8",
    )
    rel_out = out.relative_to(ROOT).as_posix()
    return {"round": round_num, "candidate_file": rel_out, "verified": len(verified), **stats}


def run_py(script: str, *args: str) -> None:
    subprocess.run(
        ["uv", "run", "python", str(SPEC / script), *args],
        cwd=ROOT,
        check=True,
    )


def integrate_candidate_files(patterns: tuple[str, ...]) -> int:
    from ai_web_feeds.utils import generate_feed_id

    from orchestrate import load_feeds, save_feeds  # noqa: E402

    doc = load_feeds()
    existing = {norm(s.get("url", "")) for s in doc.get("sources", [])}
    added = 0
    for pattern in patterns:
        for path in sorted((SPEC / "candidates").glob(pattern)):
            payload = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
            for src in payload.get("sources", []):
                key = norm(src["url"])
                if key in existing:
                    continue
                entry = {
                    "url": src["url"],
                    "topics": src["topics"],
                    "id": generate_feed_id(src["url"]),
                }
                if src.get("title"):
                    entry["title"] = src["title"]
                if src.get("notes"):
                    entry["notes"] = src["notes"]
                doc["sources"].append(entry)
                existing.add(key)
                added += 1
    meta = dict(doc.get("document_meta", {}))
    meta["updated"] = str(date.today())
    doc["document_meta"] = meta
    save_feeds(doc)
    return added


def dedupe_feeds_by_id() -> dict:
    from orchestrate import load_feeds, save_feeds  # noqa: E402

    doc = load_feeds()
    seen: set[str] = set()
    kept: list[dict] = []
    removed = 0
    for source in doc.get("sources", []):
        feed_id = source.get("id", "")
        if not feed_id or feed_id in seen:
            removed += 1
            continue
        seen.add(feed_id)
        kept.append(source)
    before = len(doc.get("sources", []))
    doc["sources"] = kept
    meta = dict(doc.get("document_meta", {}))
    meta["updated"] = str(date.today())
    doc["document_meta"] = meta
    save_feeds(doc)
    return {"before": before, "after": len(kept), "removed": removed}


async def integrate_round(round_num: int) -> int:
    from orchestrate import dedupe_feeds_by_url  # noqa: E402

    pattern = f"saturation-pass-{round_num}-research.yaml"
    added = integrate_candidate_files((pattern,))
    dedupe_feeds_by_url()
    dedupe_feeds_by_id()
    return added


async def prune_round() -> None:
    run_py("prune_unrelated.py")
    run_py("scan_offtopic.py", "--apply")


async def http_fix_round() -> dict:
    from orchestrate import dedupe_feeds_by_url, wave1_fix_and_prune  # noqa: E402

    report = await wave1_fix_and_prune()
    dedupe_feeds_by_url()
    dedupe_feeds_by_id()
    return report


def update_pass_counter(round_num: int, added: int) -> None:
    state = json.loads(PASSES_JSON.read_text(encoding="utf-8")) if PASSES_JSON.exists() else {}
    state[f"pass{round_num}"] = added
    if round_num >= 12 and all(state.get(f"pass{n}", 0) < 5 for n in range(round_num - 2, round_num + 1)):
        state["stop_rule_met"] = True
    else:
        state["stop_rule_met"] = False
    PASSES_JSON.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")


async def run_round(round_num: int) -> dict:
    before = refresh_existing_urls()
    from orchestrate import load_feeds  # noqa: E402

    catalog_before = len(load_feeds().get("sources", []))
    discovery = await discover(round_num)
    added = await integrate_round(round_num)
    await prune_round()
    http = await http_fix_round()
    refresh_existing_urls()
    catalog_after = len(load_feeds().get("sources", []))
    update_pass_counter(round_num, discovery["verified"])
    report = {
        "round": round_num,
        "catalog_before": catalog_before,
        "catalog_after": catalog_after,
        "net": catalog_after - catalog_before,
        "discovery": discovery,
        "integrated": added,
        "http_fix": {"fixed": http["fixed"], "pruned": http["pruned"], "remaining": http["remaining"]},
        "existing_urls_before": before,
    }
    out = SPEC / f"extend-prune-round-{round_num}.json"
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return report


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("rounds", nargs="+", type=int, help="Round numbers (e.g. 12 13 14)")
    args = parser.parse_args()
    summaries = []
    for n in args.rounds:
        print(f"\n=== Extend & prune round {n} ===")
        summaries.append(await run_round(n))
    combined = SPEC / "extend-prune-summary.json"
    combined.write_text(json.dumps(summaries, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(main())

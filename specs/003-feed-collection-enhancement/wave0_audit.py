"""Wave 0 baseline + HTTP audit for feed collection enhancement."""

from __future__ import annotations

import argparse
import asyncio
import json
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

import yaml

from ai_web_feeds.load import _VALID_SOURCE_TYPES, canonicalize_catalog, infer_source_type
from ai_web_feeds.validate import validate_feed_url

ROOT = Path(__file__).resolve().parents[2]
SPEC = Path(__file__).resolve().parent
DATA = ROOT / "data"


def _normalize_url(url: str) -> str:
    parsed = urlparse(url.strip().lower())
    netloc = parsed.netloc.replace("www.", "")
    path = parsed.path.rstrip("/")
    return f"{parsed.scheme}://{netloc}{path}"


def load_catalog() -> tuple[dict, dict]:
    feeds = yaml.safe_load((DATA / "feeds.yaml").read_text(encoding="utf-8"))
    topics = yaml.safe_load((DATA / "topics.yaml").read_text(encoding="utf-8"))
    return feeds, topics


def write_baseline(feeds: dict, topics: dict) -> None:
    sources = feeds.get("sources", [])
    enriched = canonicalize_catalog(feeds, enriched=True)
    topic_ids = {t["id"] for t in topics.get("topics", []) if isinstance(t, dict) and t.get("id")}
    used_topics: Counter[str] = Counter()
    for source in enriched.get("sources", []):
        for topic in source.get("topics", []):
            used_topics[topic] += 1

    source_types = Counter(infer_source_type(s) for s in enriched.get("sources", []))
    orphans = sorted(topic_ids - set(used_topics))

    baseline = {
        "source_count": len(sources),
        "topic_count": len(topic_ids),
        "orphan_topic_count": len(orphans),
        "orphan_topics": orphans,
        "source_type_distribution": dict(source_types.most_common()),
        "unused_valid_source_types": sorted(_VALID_SOURCE_TYPES - set(source_types)),
        "top_topics": dict(used_topics.most_common(15)),
        "sparse_topics": {k: v for k, v in used_topics.items() if v <= 2},
    }
    (SPEC / "baseline.json").write_text(json.dumps(baseline, indent=2) + "\n", encoding="utf-8")


def write_orphan_matrix(topics: dict, feeds: dict) -> None:
    enriched = canonicalize_catalog(feeds, enriched=True)
    used = {t for s in enriched["sources"] for t in s.get("topics", [])}
    lines = ["# Orphan Topic Matrix", ""]
    for topic in topics.get("topics", []):
        if not isinstance(topic, dict):
            continue
        tid = topic.get("id")
        if tid in used:
            continue
        rank = topic.get("rank_hint", "")
        facet = topic.get("facet", "")
        lines.append(f"- **{tid}** (facet={facet}, rank_hint={rank}) → **Activate**")
    (SPEC / "orphan-matrix.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_saturation(feeds: dict) -> None:
    enriched = canonicalize_catalog(feeds, enriched=True)
    topics = Counter()
    types = Counter()
    for source in enriched["sources"]:
        types[infer_source_type(source)] += 1
        for topic in source.get("topics", []):
            topics[topic] += 1
    lines = [
        "# Saturation Map",
        "",
        "## Source types",
        "",
    ]
    for name, count in types.most_common():
        lines.append(f"- {name}: {count}")
    lines.extend(["", "## Topics (under 3 sources)", ""])
    for name, count in sorted(topics.items(), key=lambda item: item[1]):
        if count < 3:
            lines.append(f"- {name}: {count}")
    (SPEC / "saturation.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_duplicates(feeds: dict) -> None:
    sources = feeds.get("sources", [])
    exact: Counter[str] = Counter()
    normalized: dict[str, list[str]] = {}
    for source in sources:
        url = source.get("url") or source.get("feed") or ""
        if not url:
            continue
        exact[url] += 1
        key = _normalize_url(url)
        normalized.setdefault(key, []).append(source.get("id") or url)

    lines = ["# Duplicate URL Scan", "", "## Exact duplicates", ""]
    for url, count in exact.items():
        if count > 1:
            lines.append(f"- {url} ({count}x)")
    lines.extend(["", "## Normalized collisions", ""])
    for key, ids in sorted(normalized.items()):
        if len(ids) > 1:
            lines.append(f"- {key}: {', '.join(ids)}")
    existing_urls = sorted({s.get("url") or s.get("feed") for s in sources if s.get("url") or s.get("feed")})
    (SPEC / "duplicates.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    (SPEC / "existing-urls.txt").write_text("\n".join(existing_urls) + "\n", encoding="utf-8")


async def audit_http(shard: int | None, shard_count: int, concurrency: int) -> list[dict]:
    feeds, _ = load_catalog()
    sources = feeds.get("sources", [])
    if shard is not None:
        size = (len(sources) + shard_count - 1) // shard_count
        start = (shard - 1) * size
        sources = sources[start : start + size]

    async def check(source: dict, index: int) -> dict:
        url = source.get("feed") or source.get("url") or ""
        result = await validate_feed_url(url) if url else {"success": False, "error_message": "missing url"}
        return {
            "index": index,
            "id": source.get("id"),
            "title": source.get("title"),
            "url": url,
            "success": result.get("success", False),
            "status_code": result.get("status_code"),
            "error_message": result.get("error_message"),
            "entry_count": result.get("entry_count", 0),
            "feed_format": result.get("feed_format"),
        }

    sem = asyncio.Semaphore(concurrency)

    async def bounded(idx_source: tuple[int, dict]) -> dict:
        idx, source = idx_source
        async with sem:
            return await check(source, idx)

    return await asyncio.gather(*[bounded((i, s)) for i, s in enumerate(sources)])


def merge_http_shards() -> None:
    http_dir = SPEC / "http"
    results: list[dict] = []
    for path in sorted(http_dir.glob("shard-*.json")):
        results.extend(json.loads(path.read_text(encoding="utf-8")))
    failures = [r for r in results if not r.get("success")]
    lines = [
        "# HTTP Audit",
        "",
        f"Total checked: {len(results)}",
        f"Failures: {len(failures)}",
        "",
        "## Failures",
        "",
    ]
    for row in failures:
        lines.append(
            f"- `{row.get('id')}` {row.get('title')}: {row.get('url')} "
            f"— {row.get('error_message')} (HTTP {row.get('status_code')})"
        )
    (SPEC / "http-audit.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    (SPEC / "http-results.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline", action="store_true")
    parser.add_argument("--http-shard", type=int)
    parser.add_argument("--http-shards", type=int, default=10)
    parser.add_argument("--merge-http", action="store_true")
    parser.add_argument("--concurrency", type=int, default=8)
    args = parser.parse_args()

    if args.baseline:
        feeds, topics = load_catalog()
        write_baseline(feeds, topics)
        write_orphan_matrix(topics, feeds)
        write_saturation(feeds)
        write_duplicates(feeds)
        print("baseline artifacts written")

    if args.http_shard:
        results = asyncio.run(audit_http(args.http_shard, args.http_shards, args.concurrency))
        out = SPEC / "http" / f"shard-{args.http_shard:02d}.json"
        out.write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
        print(f"wrote {out} ({len(results)} sources)")

    if args.merge_http:
        merge_http_shards()
        print("merged http audit")


if __name__ == "__main__":
    main()
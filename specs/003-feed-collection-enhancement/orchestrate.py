"""Orchestrate Waves 1-4 for feed collection enhancement."""

from __future__ import annotations

import asyncio
import json
import subprocess
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

import yaml

from ai_web_feeds.utils import detect_platform, generate_feed_id, generate_platform_feed_url
from ai_web_feeds.validate import validate_feed_url

ROOT = Path(__file__).resolve().parents[2]
SPEC = Path(__file__).resolve().parent
DATA = ROOT / "data"
FEEDS_PATH = DATA / "feeds.yaml"

# norm(url) -> working feed URL (HTTP-verified replacements for common breakages)
SPECIAL_FIXES_RAW: dict[str, str] = {
    "https://blog.eleuther.ai/": "https://blog.eleuther.ai/index.xml",
    "https://hamel.dev/atom.xml": "https://hamel.dev/index.xml",
    "https://sebastianraschka.com/rss.xml": "https://sebastianraschka.com/blog/feed.xml",
    "https://huggingface.co/blog": "https://huggingface.co/blog/feed.xml",
    "https://ai.googleblog.com": "https://research.google/blog/rss/",
    "https://openai.com/blog/rss/": "https://openai.com/news/rss.xml",
    "https://openai.com/blog/rss.xml": "https://openai.com/news/rss.xml",
    "https://txt.cohere.ai/rss/": "https://txt.cohere.com/rss/",
    "https://arize.com/blog": "https://arize.com/blog/feed/",
    "https://www.pinecone.io/learn/feed.xml": "https://www.pinecone.io/feed.xml",
    "https://mistral.ai/news": "https://mistral.ai/rss.xml",
    "https://ai.meta.com/blog/": "https://ai.meta.com/blog/rss/",
    "https://allenai.org/blog": "https://allenai.org/blog/feed",
    "https://dev.to/t/machinelearning": "https://dev.to/feed/tag/machinelearning",
    "https://www.reddit.com/r/MachineLearning": "https://www.reddit.com/r/MachineLearning/hot/.rss",
    "https://www.reddit.com/r/artificial": "https://www.reddit.com/r/artificial/hot/.rss",
    "https://www.reddit.com/r/LocalLLaMA": "https://www.reddit.com/r/LocalLLaMA/hot/.rss",
    "https://blog.neurips.cc/feed": "https://blog.neurips.cc/feed/",
    "https://blog.iclr.cc/feed": "https://blog.iclr.cc/feed/",
    "https://groq.com/blog": "https://groq.com/blog/feed/",
    "https://replicate.com/blog": "https://replicate.com/blog/rss.xml",
    "https://www.together.ai/blog": "https://www.together.ai/blog/feed",
    "https://www.perplexity.ai/hub/blog": "https://www.perplexity.ai/hub/blog/rss.xml",
    "https://cursor.com/blog": "https://cursor.com/blog/rss.xml",
    "https://www.fiddler.ai/blog": "https://www.fiddler.ai/blog/rss.xml",
    "https://huyenchip.net": "https://huyenchip.net/feed.xml",
    "https://www.deeplearning.ai/the-batch": "https://www.deeplearning.ai/the-batch/tag/feed/",
    "https://aneyeonai.libsyn.com/rss": "https://rss.libsyn.com/shows/123267/destinations/727317.xml",
}

EXTRA_CANDIDATES = [
    {"url": "https://huyenchip.net/feed.xml", "title": "Chip Huyen", "topics": ["blogs", "mlops", "education"], "notes": "ML systems design"},
    {"url": "http://export.arxiv.org/rss/cs.SE", "title": "arXiv cs.SE", "topics": ["research", "papers", "ai-for-code"], "notes": "Software engineering preprints"},
    {"url": "http://export.arxiv.org/rss/stat.ML", "title": "arXiv stat.ML", "topics": ["research", "papers", "ml"], "notes": "Statistics ML preprints"},
    {"url": "http://export.arxiv.org/rss/cs.IR", "title": "arXiv cs.IR", "topics": ["research", "papers", "retrieval"], "notes": "Information retrieval preprints"},
    {"url": "https://huggingface.co/blog/feed.xml", "title": "Hugging Face Blog RSS", "topics": ["organization", "open-source", "llm"], "notes": "Duplicate guard: skip if exists"},
    {"url": "https://www.deeplearning.ai/the-batch/tag/feed/", "title": "The Batch", "topics": ["newsletters", "education", "industry"], "notes": "Andrew Ng newsletter"},
    {"url": "https://www.maginative.com/feed/", "title": "Maginative", "topics": ["newsletters", "industry", "product"], "notes": "AI news newsletter"},
    {"url": "https://www.therundown.ai/feed", "title": "The Rundown AI", "topics": ["newsletters", "industry", "product"], "notes": "Daily AI newsletter"},
    {"url": "https://www.cognitiverevolution.ai/feed", "title": "Cognitive Revolution", "topics": ["podcasts", "industry", "product"], "notes": "AI product podcast"},
    {"url": "https://podcast.latent.space/feed", "title": "Latent Space Podcast", "topics": ["podcasts", "llm", "industry"], "notes": "Latent Space audio feed"},
    {"url": "https://feeds.megaphone.fm/aibreakdown", "title": "The AI Breakdown", "topics": ["podcasts", "industry", "llm"], "notes": "Daily AI news podcast"},
    {"url": "https://feeds.simplecast.com/lKmQ2yWJ", "title": "Hard Fork", "topics": ["podcasts", "industry", "governance"], "notes": "NYT tech podcast"},
    {"url": "https://podcast.mlops.community/feed", "title": "MLOps Community Podcast", "topics": ["podcasts", "mlops", "devtools"], "notes": "MLOps podcast"},
    {"url": "https://lineardigressions.com/feed", "title": "Linear Digressions", "topics": ["podcasts", "ml", "education"], "notes": "ML podcast"},
    {"url": "https://www.interconnects.ai/feed", "title": "Interconnects", "topics": ["blogs", "industry", "llm"], "notes": "skip if dup"},
    {"url": "https://research.google/blog/rss/", "title": "Google Research", "topics": ["organization", "research"], "notes": "skip if dup"},
    {"url": "https://www.alignmentforum.org/tag/alignment/rss", "title": "AF Alignment Tag", "topics": ["forum", "safety", "research"], "notes": "Alignment Forum tag feed"},
    {"url": "https://stackoverflow.com/feeds/tag?tagnames=machine-learning&sort=newest", "title": "SO Machine Learning", "topics": ["forum", "ml", "education"], "notes": "Stack Overflow ML tag"},
    {"url": "https://groq.com/blog/feed/", "title": "Groq Blog RSS", "topics": ["organization", "inference", "llm"], "notes": "Replace page URL with feed"},
    {"url": "https://replicate.com/blog/rss.xml", "title": "Replicate Blog RSS", "topics": ["organization", "inference", "open-source"], "notes": "Replace page URL with feed"},
    {"url": "https://www.together.ai/blog/feed", "title": "Together AI Blog RSS", "topics": ["organization", "inference", "llm"], "notes": "Replace page URL with feed"},
    {"url": "https://mistral.ai/feed.xml", "title": "Mistral News RSS", "topics": ["organization", "llm", "open-source"], "notes": "Mistral news feed"},
    {"url": "https://www.perplexity.ai/hub/blog/rss.xml", "title": "Perplexity Blog", "topics": ["organization", "llm", "product"], "notes": "Perplexity blog RSS"},
    {"url": "https://cursor.com/blog/rss.xml", "title": "Cursor Blog", "topics": ["organization", "ai-for-code", "product"], "notes": "Cursor IDE blog"},
    {"url": "https://www.fiddler.ai/blog/rss.xml", "title": "Fiddler AI", "topics": ["organization", "evaluation", "governance"], "notes": "skip if dup"},
]


def norm(url: str) -> str:
    p = urlparse(url.strip().lower())
    return f"{p.scheme}://{p.netloc.replace('www.', '')}{p.path.rstrip('/')}"


SPECIAL_FIXES = {norm(k): v for k, v in SPECIAL_FIXES_RAW.items()}


def load_feeds() -> dict:
    return yaml.safe_load(FEEDS_PATH.read_text(encoding="utf-8"))


def restore_git_head_feeds() -> int:
    """Restore data/feeds.yaml from git HEAD (pre-goal baseline catalog)."""
    result = subprocess.run(
        ["git", "show", "HEAD:data/feeds.yaml"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    FEEDS_PATH.write_text(result.stdout, encoding="utf-8")
    doc = load_feeds()
    return len(doc.get("sources", []))


def save_feeds(doc: dict) -> None:
    FEEDS_PATH.write_text(yaml.safe_dump(doc, sort_keys=False, allow_unicode=True), encoding="utf-8")


def dedupe_feeds_by_url() -> dict:
    """Collapse duplicate normalized URLs; merge topics (max 6) and keep richer metadata."""
    doc = load_feeds()
    merged: dict[str, dict] = {}
    order: list[str] = []
    for source in doc.get("sources", []):
        key = norm(source.get("url", ""))
        if not key:
            continue
        if key not in merged:
            merged[key] = dict(source)
            order.append(key)
            continue
        existing = merged[key]
        topics = list(existing.get("topics", []))
        for topic in source.get("topics", []):
            if topic not in topics and len(topics) < 6:
                topics.append(topic)
        existing["topics"] = topics
        if not existing.get("title") and source.get("title"):
            existing["title"] = source["title"]
        if not existing.get("notes") and source.get("notes"):
            existing["notes"] = source["notes"]
    before = len(doc.get("sources", []))
    doc["sources"] = [merged[k] for k in order]
    meta = dict(doc.get("document_meta", {}))
    meta["updated"] = str(date.today())
    doc["document_meta"] = meta
    save_feeds(doc)
    return {"before": before, "after": len(doc["sources"]), "removed": before - len(doc["sources"])}


def existing_urls() -> set[str]:
    urls = set()
    for line in (SPEC / "existing-urls.txt").read_text(encoding="utf-8").splitlines():
        if line.strip():
            urls.add(norm(line))
    return urls


async def check_url(url: str) -> dict:
    return await validate_feed_url(url)


def candidate_urls(url: str) -> list[str]:
    base = url.rstrip("/")
    out: list[str] = []
    for key in (norm(url), norm(base), url.rstrip("/"), url):
        if key in SPECIAL_FIXES:
            out.append(SPECIAL_FIXES[key])
    platform = detect_platform(url)
    if platform:
        generated = generate_platform_feed_url(url, platform)
        if generated:
            out.append(generated)
    for suffix in ("/feed", "/feed.xml", "/rss", "/rss.xml", "/atom.xml", "/index.xml"):
        out.append(base + suffix)
    seen: set[str] = set()
    deduped: list[str] = []
    for item in out:
        if item and item not in seen:
            seen.add(item)
            deduped.append(item)
    return deduped


async def find_working_url(url: str) -> str | None:
    for cand in candidate_urls(url):
        result = await validate_feed_url(cand)
        if result.get("success"):
            return cand
    return None


async def wave1_fix_and_prune() -> dict:
    doc = load_feeds()
    sources = doc["sources"]
    fixed: list[dict] = []
    pruned: list[dict] = []
    sem = asyncio.Semaphore(12)

    async def process(source: dict) -> tuple[dict, str | None, str | None]:
        url = source.get("url") or ""
        async with sem:
            current = await validate_feed_url(url)
        if current.get("success"):
            return source, None, None
        async with sem:
            replacement = await find_working_url(url)
        if replacement:
            updated = dict(source)
            updated["url"] = replacement
            note = (updated.get("notes") or "").strip()
            if "HTTP fix" not in note:
                updated["notes"] = (note + " HTTP fix: feed URL discovered 2026-06-24.").strip()
            return updated, url, replacement
        return source, url, None

    results = await asyncio.gather(*[process(s) for s in sources])
    kept: list[dict] = []
    for source, old, new in results:
        if new:
            fixed.append({"id": source.get("id"), "title": source.get("title"), "old": old, "new": new})
            kept.append(source)
        elif old is not None:
            # strict prune: unfixable
            pruned.append({"id": source.get("id"), "title": source.get("title"), "url": old})
        else:
            kept.append(source)

    doc["sources"] = kept
    meta = dict(doc.get("document_meta", {}))
    meta["updated"] = str(date.today())
    doc["document_meta"] = meta
    save_feeds(doc)
    report = {"fixed": len(fixed), "pruned": len(pruned), "remaining": len(kept), "details": {"fixed": fixed, "pruned": pruned}}
    (SPEC / "wave1-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


async def wave2_approve(target: int = 80) -> dict:
    approved_dir = SPEC / "candidates" / "approved"
    approved_dir.mkdir(parents=True, exist_ok=True)
    urls_seen = existing_urls()
    approved: list[dict] = []

    # load shard candidates
    for path in sorted((SPEC / "candidates").glob("*.yaml")):
        payload = yaml.safe_load(path.read_text(encoding="utf-8"))
        for src in payload.get("sources", []):
            key = norm(src["url"])
            if key in urls_seen:
                continue
            result = await validate_feed_url(src["url"])
            if result.get("success"):
                approved.append(src)
                urls_seen.add(key)

    # top up from extras
    for src in EXTRA_CANDIDATES:
        if len(approved) >= target:
            break
        key = norm(src["url"])
        if key in urls_seen:
            continue
        result = await validate_feed_url(src["url"])
        if result.get("success"):
            approved.append(src)
            urls_seen.add(key)

    # write per-shard approved files (single bundle for integration)
    bundle = {"sources": approved[:120]}
    (approved_dir / "MANIFEST.yaml").write_text(
        yaml.safe_dump(bundle, sort_keys=False, allow_unicode=True), encoding="utf-8"
    )
    manifest = {
        "count": len(approved),
        "target_min": 80,
        "target_max": 120,
        "selected": len(bundle["sources"]),
        "urls": [s["url"] for s in bundle["sources"]],
    }
    (approved_dir / "MANIFEST.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def apply_orphan_retags() -> dict:
    report_path = SPEC / "orphan-retag-report.json"
    if not report_path.exists():
        return {"applied": 0}
    report = json.loads(report_path.read_text(encoding="utf-8"))
    doc = load_feeds()
    by_url = {norm(s.get("url", "")): s for s in doc["sources"]}
    applied = 0
    for retag in report.get("retagged", []):
        src = by_url.get(norm(retag["url"]))
        if not src:
            continue
        topics = list(src.get("topics", []))
        for topic in retag.get("added_topics", []):
            if topic not in topics and len(topics) < 6:
                topics.append(topic)
                applied += 1
        src["topics"] = topics
    meta = dict(doc.get("document_meta", {}))
    meta["updated"] = str(date.today())
    doc["document_meta"] = meta
    save_feeds(doc)
    return {"applied": applied}


def integrate_all_candidates() -> int:
    """Merge approved shards, MANIFEST, and saturation passes into feeds.yaml."""
    doc = load_feeds()
    existing = {norm(s.get("url", "")) for s in doc["sources"]}
    added = 0
    candidate_paths: list[Path] = []
    approved_dir = SPEC / "candidates" / "approved"
    candidates_dir = SPEC / "candidates"
    for pattern in ("approved/*.yaml", "saturation-pass-*.yaml"):
        candidate_paths.extend(sorted(candidates_dir.glob(pattern.split("/")[-1])))
    if approved_dir.exists():
        candidate_paths.extend(sorted(approved_dir.glob("*.yaml")))
    seen_paths: set[Path] = set()
    for path in candidate_paths:
        if path in seen_paths or path.name == "MANIFEST.yaml":
            continue
        seen_paths.add(path)
        payload = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        for src in payload.get("sources", []):
            url = src.get("url", "")
            key = norm(url)
            if not url or key in existing:
                continue
            entry: dict = {"url": url, "topics": src["topics"]}
            if src.get("title"):
                entry["title"] = src["title"]
            if src.get("notes"):
                entry["notes"] = src["notes"]
            entry["id"] = generate_feed_id(url)
            doc["sources"].append(entry)
            existing.add(key)
            added += 1
    meta = dict(doc.get("document_meta", {}))
    meta["updated"] = str(date.today())
    doc["document_meta"] = meta
    save_feeds(doc)
    (SPEC / "wave3-report.json").write_text(
        json.dumps({"added": added, "total": len(doc["sources"])}, indent=2) + "\n",
        encoding="utf-8",
    )
    return added


async def integrate_http_verified_candidates(
    *,
    min_total: int = 319,
    max_new: int = 120,
) -> dict:
    """Add HTTP-verified candidates until min_total or max_new reached."""
    doc = load_feeds()
    existing = {norm(s.get("url", "")) for s in doc["sources"]}
    before = len(doc["sources"])
    candidates_dir = SPEC / "candidates"
    paths: list[Path] = []
    paths.extend(sorted(candidates_dir.glob("saturation-pass-*.yaml")))
    approved_dir = candidates_dir / "approved"
    if approved_dir.exists():
        paths.extend(sorted(approved_dir.glob("*.yaml")))
    paths.extend(sorted(candidates_dir.glob("*.yaml")))
    seen_paths: set[Path] = set()
    pending: list[dict] = []
    for path in paths:
        if path in seen_paths or path.name == "MANIFEST.yaml":
            continue
        seen_paths.add(path)
        payload = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        for src in payload.get("sources", []):
            url = src.get("url", "")
            if not url or norm(url) in existing:
                continue
            pending.append(src)

    added = 0
    sem = asyncio.Semaphore(10)

    async def verify_and_append(src: dict) -> bool:
        nonlocal added
        if len(doc["sources"]) >= min_total or added >= max_new:
            return False
        url = src["url"]
        async with sem:
            ok = await validate_feed_url(url)
        if not ok.get("success"):
            async with sem:
                replacement = await find_working_url(url)
            if not replacement:
                return False
            src = dict(src)
            src["url"] = replacement
            url = replacement
        key = norm(url)
        if key in existing:
            return False
        entry: dict = {"url": url, "topics": src["topics"]}
        if src.get("title"):
            entry["title"] = src["title"]
        if src.get("notes"):
            entry["notes"] = src["notes"]
        entry["id"] = generate_feed_id(url)
        doc["sources"].append(entry)
        existing.add(key)
        added += 1
        return True

    for src in pending:
        if len(doc["sources"]) >= min_total or added >= max_new:
            break
        await verify_and_append(src)

    meta = dict(doc.get("document_meta", {}))
    meta["updated"] = str(date.today())
    doc["document_meta"] = meta
    save_feeds(doc)
    return {"before": before, "after": len(doc["sources"]), "added": added, "pending": len(pending)}


def sanitize_enriched_source(source: dict) -> dict:
    cleaned = dict(source)
    if cleaned.get("site") is None:
        cleaned.pop("site", None)
    return cleaned


def canonicalize_enriched_output() -> None:
    from ai_web_feeds.load import canonicalize_catalog

    enriched_path = DATA / "feeds.enriched.yaml"
    doc = yaml.safe_load(enriched_path.read_text(encoding="utf-8"))
    doc = canonicalize_catalog(doc, enriched=True)
    doc["sources"] = [sanitize_enriched_source(s) for s in doc.get("sources", [])]
    enriched_path.write_text(
        yaml.safe_dump(doc, sort_keys=False, allow_unicode=True),
        encoding="utf-8",
    )


def reapply_wave1_prune() -> dict:
    report_path = SPEC / "wave1-report.json"
    if not report_path.exists():
        return {"removed": 0}
    report = json.loads(report_path.read_text(encoding="utf-8"))
    pruned_ids = {item["id"] for item in report.get("details", {}).get("pruned", [])}
    doc = load_feeds()
    before = len(doc["sources"])
    doc["sources"] = [s for s in doc["sources"] if s.get("id") not in pruned_ids]
    meta = dict(doc.get("document_meta", {}))
    meta["updated"] = str(date.today())
    doc["document_meta"] = meta
    save_feeds(doc)
    return {"removed": before - len(doc["sources"]), "remaining": len(doc["sources"])}


def wave3_integrate() -> int:
    doc = load_feeds()
    manifest = yaml.safe_load((SPEC / "candidates" / "approved" / "MANIFEST.yaml").read_text(encoding="utf-8"))
    existing = {norm(s.get("url", "")) for s in doc["sources"]}
    added = 0
    for src in manifest.get("sources", []):
        key = norm(src["url"])
        if key in existing:
            continue
        entry = {
            "url": src["url"],
            "topics": src["topics"],
        }
        if src.get("title"):
            entry["title"] = src["title"]
        if src.get("notes"):
            entry["notes"] = src["notes"]
        entry["id"] = generate_feed_id(src["url"])
        doc["sources"].append(entry)
        existing.add(key)
        added += 1
    meta = dict(doc.get("document_meta", {}))
    meta["updated"] = str(date.today())
    meta["notes"] = "Expanded via specs/003-feed-collection-enhancement orchestration."
    doc["document_meta"] = meta
    save_feeds(doc)
    (SPEC / "wave3-report.json").write_text(json.dumps({"added": added, "total": len(doc["sources"])}, indent=2) + "\n", encoding="utf-8")
    return added


def sync_db_from_enriched() -> int:
    """Replace SQLite feed_sources with the enriched catalog (1:1)."""
    from sqlmodel import delete

    from ai_web_feeds.config import DEFAULT_DATABASE_URL
    from ai_web_feeds.models import FeedSource
    from ai_web_feeds.storage import DatabaseManager, upgrade_database_to_head

    upgrade_database_to_head(DEFAULT_DATABASE_URL)
    db = DatabaseManager(DEFAULT_DATABASE_URL)
    with db.get_session() as session:
        session.exec(delete(FeedSource))
        session.commit()

    enriched = yaml.safe_load((DATA / "feeds.enriched.yaml").read_text(encoding="utf-8"))
    for source in enriched.get("sources", []):
        feed_source = FeedSource(
            id=source["id"],
            url=source.get("url"),
            feed=source.get("feed") or source.get("url"),
            site=source.get("site"),
            title=source.get("title", "Untitled"),
            topics=source.get("topics", []),
            tags=source.get("tags", source.get("topics", [])),
        )
        db.add_feed_source(feed_source)
    return len(enriched.get("sources", []))


def run_cmd(cmd: list[str]) -> None:
    print("$", " ".join(cmd))
    subprocess.run(cmd, cwd=ROOT, check=True)


async def wave4_audit() -> dict:
    doc = load_feeds()
    sources = doc["sources"]
    sem = asyncio.Semaphore(12)

    async def one(s: dict) -> bool:
        async with sem:
            r = await validate_feed_url(s.get("url", ""))
        return bool(r.get("success"))

    oks = await asyncio.gather(*[one(s) for s in sources])
    ok = sum(1 for x in oks if x)
    stats = {"total": len(sources), "ok": ok, "fail": len(sources) - ok, "rate": round(100 * ok / max(len(sources), 1), 1)}
    (SPEC / "wave4-http.json").write_text(json.dumps(stats, indent=2) + "\n", encoding="utf-8")
    return stats


async def goal_pipeline() -> None:
    print("=== Pre: orphan retag + integrate all candidates ===")
    retag = apply_orphan_retags()
    print("retag topics applied:", retag["applied"])
    added = integrate_all_candidates()
    print("integrated", added, "new candidates")

    print("=== Wave 1: HTTP fix + strict prune ===")
    w1 = await wave1_fix_and_prune()
    print(w1["fixed"], "fixed,", w1["pruned"], "pruned,", w1["remaining"], "remaining")
    guard = reapply_wave1_prune()
    print("prune guard removed", guard["removed"], "remaining", guard["remaining"])

    print("=== Wave 2: approve remaining candidates ===")
    w2 = await wave2_approve(target=80)
    print("approved", w2["selected"], "for integration")
    extra = wave3_integrate()
    print("manifest integrate added", extra)

    print("=== Wave 3: enrich + export + canonicalize ===")
    run_cmd(["uv", "run", "ai-web-feeds", "validate", "all"])
    run_cmd(
        [
            "uv",
            "run",
            "ai-web-feeds",
            "enrich",
            "all",
            "--input",
            "data/feeds.yaml",
            "--output",
            "data/feeds.enriched.yaml",
        ]
    )
    canonicalize_enriched_output()
    run_cmd(
        [
            "uv",
            "run",
            "ai-web-feeds",
            "export",
            "all",
            "--input",
            "data/feeds.enriched.yaml",
            "--output-dir",
            "data",
        ]
    )
    run_cmd(
        [
            "uv",
            "run",
            "ai-web-feeds",
            "export",
            "all",
            "--input",
            "data/feeds.yaml",
            "--output-dir",
            "data",
        ]
    )

    print("=== Wave 4: verify ===")
    run_cmd(["uv", "run", "python", "data/validate_data_assets.py"])
    http = await wave4_audit()
    print("final HTTP audit", http)
    run_cmd(
        [
            "uv",
            "run",
            "pytest",
            "tests/packages/ai_web_feeds/unit/test_data_asset_validation.py",
            "-q",
            "--no-header",
        ]
    )
    print("DONE")


async def goal_finalize() -> None:
    """Fast path: retag, dedupe, enrich/export/verify (skip HTTP re-scan)."""
    print("=== Finalize: retag + dedupe ===")
    retag = apply_orphan_retags()
    print("retag topics applied:", retag["applied"])
    dedupe = dedupe_feeds_by_url()
    print("dedupe:", dedupe)

    print("=== Enrich + export + canonicalize ===")
    run_cmd(["uv", "run", "ai-web-feeds", "validate", "all"])
    run_cmd(
        [
            "uv",
            "run",
            "ai-web-feeds",
            "enrich",
            "all",
            "--input",
            "data/feeds.yaml",
            "--output",
            "data/feeds.enriched.yaml",
        ]
    )
    canonicalize_enriched_output()
    run_cmd(
        [
            "uv",
            "run",
            "ai-web-feeds",
            "export",
            "all",
            "--input",
            "data/feeds.enriched.yaml",
            "--output-dir",
            "data",
        ]
    )
    run_cmd(
        [
            "uv",
            "run",
            "ai-web-feeds",
            "export",
            "all",
            "--input",
            "data/feeds.yaml",
            "--output-dir",
            "data",
        ]
    )
    synced = sync_db_from_enriched()
    print("db synced", synced, "sources")

    print("=== Verify ===")
    run_cmd(["uv", "run", "python", "data/validate_data_assets.py"])
    http = await wave4_audit()
    print("final HTTP audit", http)


async def goal_rebuild() -> None:
    """Clean single-pass rebuild: git HEAD base + candidates + retag + HTTP fix + finalize."""
    print("=== Rebuild: restore git HEAD ===")
    count = restore_git_head_feeds()
    print("restored", count, "sources from HEAD")
    retag = apply_orphan_retags()
    print("retag topics applied:", retag["applied"])
    added = integrate_all_candidates()
    print("integrated", added, "candidates")
    w1 = await wave1_fix_and_prune()
    print("wave1:", w1["fixed"], "fixed,", w1["pruned"], "pruned,", w1["remaining"], "remaining")
    dedupe = dedupe_feeds_by_url()
    print("dedupe:", dedupe)
    await goal_finalize()


async def restore_pruned_with_fixes(*, min_total: int = 319) -> dict:
    """Re-add wave1-pruned sources when find_working_url discovers a feed."""
    report_path = SPEC / "wave1-report.json"
    if not report_path.exists():
        return {"restored": 0}
    report = json.loads(report_path.read_text(encoding="utf-8"))
    pruned = report.get("details", {}).get("pruned", [])
    doc = load_feeds()
    existing = {norm(s.get("url", "")) for s in doc["sources"]}
    before = len(doc["sources"])
    restored = 0
    sem = asyncio.Semaphore(6)

    async def try_restore(item: dict) -> None:
        nonlocal restored
        if len(doc["sources"]) >= min_total:
            return
        old_url = item.get("url", "")
        async with sem:
            working = await find_working_url(old_url)
        if not working or norm(working) in existing:
            return
        entry = {
            "url": working,
            "title": item.get("title", "Untitled"),
            "topics": ["research", "industry"],
            "notes": f"Restored from pruned URL {old_url} via feed discovery.",
            "id": generate_feed_id(working),
        }
        doc["sources"].append(entry)
        existing.add(norm(working))
        restored += 1

    await asyncio.gather(*[try_restore(item) for item in pruned])
    meta = dict(doc.get("document_meta", {}))
    meta["updated"] = str(date.today())
    doc["document_meta"] = meta
    save_feeds(doc)
    return {"before": before, "after": len(doc["sources"]), "restored": restored}


async def goal_expand() -> None:
    """Grow catalog toward G4 floors (>=319) with HTTP-verified candidates only."""
    print("=== Expand: HTTP-verified candidate integration ===")
    retag = apply_orphan_retags()
    print("retag topics applied:", retag["applied"])
    bulk = integrate_all_candidates()
    print("bulk integrated", bulk, "candidates")
    verified = await integrate_http_verified_candidates(min_total=319, max_new=120)
    print("verified integrate:", verified)
    restored = await restore_pruned_with_fixes(min_total=319)
    print("restored pruned with fixes:", restored)
    w2 = await wave2_approve(target=120)
    print("wave2 approved", w2.get("selected", 0))
    extra = wave3_integrate()
    print("manifest integrate added", extra)
    w1 = await wave1_fix_and_prune()
    print("wave1:", w1["fixed"], "fixed,", w1["pruned"], "pruned,", w1["remaining"], "remaining")
    dedupe = dedupe_feeds_by_url()
    print("dedupe:", dedupe)
    await goal_finalize()


async def main() -> None:
    mode = sys.argv[1] if len(sys.argv) > 1 else "full"
    if mode == "finalize":
        await goal_finalize()
    elif mode == "rebuild":
        await goal_rebuild()
    elif mode == "expand":
        await goal_expand()
    else:
        await goal_pipeline()


if __name__ == "__main__":
    asyncio.run(main())

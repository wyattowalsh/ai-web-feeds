"""Fetch feeds and preview discovered metadata."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime
import json
from email.utils import parsedate_to_datetime
from typing import Any

import feedparser
import httpx
import typer
from ai_web_feeds.config import DEFAULT_DATABASE_URL
from ai_web_feeds.fetcher import AdvancedFeedFetcher
from ai_web_feeds.storage import DatabaseManager
from loguru import logger
from rich import box
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table
from sqlalchemy.exc import IntegrityError

app = typer.Typer(help="Fetch feed URLs and preview metadata")
cli = app


@dataclass(slots=True)
class FetchSummary:
    """Structured summary for fetch previews."""

    url: str
    status_code: int
    content_type: str | None
    content_length: int
    duration_ms: int
    entry_count: int
    title: str | None
    description: str | None
    language: str | None
    author: str | None
    quality_score: float
    completeness_score: float
    health_score: float
    entries: list[dict[str, Any]]

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serialisable representation."""
        return {
            "url": self.url,
            "status_code": self.status_code,
            "content_type": self.content_type,
            "content_length": self.content_length,
            "duration_ms": self.duration_ms,
            "entry_count": self.entry_count,
            "title": self.title,
            "description": self.description,
            "language": self.language,
            "author": self.author,
            "quality_score": round(self.quality_score, 3),
            "completeness_score": round(self.completeness_score, 3),
            "health_score": round(self.health_score, 3),
            "entries": self.entries,
        }


def _coerce_datetime(entry: Any, *keys: str) -> datetime | None:
    """Parse a published/updated timestamp from a feed entry."""
    for key in keys:
        parsed = entry.get(f"{key}_parsed")
        if parsed:
            return datetime(*parsed[:6], tzinfo=UTC)

        raw = entry.get(key)
        if not raw:
            continue
        try:
            parsed_dt = parsedate_to_datetime(raw)
        except (TypeError, ValueError):
            continue
        if parsed_dt.tzinfo is None:
            return parsed_dt.replace(tzinfo=UTC)
        return parsed_dt.astimezone(UTC)
    return None


def _entry_preview(entry: Any) -> dict[str, Any]:
    """Build a small preview payload for a feed entry."""
    preview = {
        "title": entry.get("title", "Untitled"),
        "link": entry.get("link"),
        "author": entry.get("author"),
    }
    published = _coerce_datetime(entry, "published", "updated")
    if published is not None:
        preview["published"] = published.isoformat()
    return preview


async def _fetch_summary(feed_url: str, *, timeout: float, include_entries: bool) -> FetchSummary:
    """Fetch a URL and extract a metadata preview."""
    started_at = datetime.now(UTC)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        response = await client.get(feed_url)
        response.raise_for_status()

    parsed_feed = feedparser.parse(response.content)
    enrichment = await AdvancedEnricher(timeout=timeout).enrich_from_url(feed_url, url_type="feed")
    entries = list(parsed_feed.entries)
    preview_entries = [_entry_preview(entry) for entry in entries[:5]] if include_entries else []
    duration_ms = int((datetime.now(UTC) - started_at).total_seconds() * 1000)

    return FetchSummary(
        url=feed_url,
        status_code=response.status_code,
        content_type=response.headers.get("content-type"),
        content_length=len(response.content),
        duration_ms=duration_ms,
        entry_count=len(entries),
        title=enrichment.title or parsed_feed.feed.get("title"),
        description=enrichment.description or parsed_feed.feed.get("description"),
        language=enrichment.language or parsed_feed.feed.get("language"),
        author=enrichment.author or parsed_feed.feed.get("author"),
        quality_score=enrichment.quality_score,
        completeness_score=enrichment.completeness_score,
        health_score=enrichment.health_score,
        entries=preview_entries,
    )


def _print_fetch_text(summary: FetchSummary, *, metadata_only: bool, verbose: bool) -> None:
    """Render fetch output in a human-friendly table form."""
    details = CommandResult(
        status="success",
        summary=f"Fetched {summary.url}",
        details={
            "status_code": summary.status_code,
            "content_type": summary.content_type,
            "content_length": summary.content_length,
            "duration_ms": summary.duration_ms,
            "entry_count": summary.entry_count,
            "title": summary.title,
            "language": summary.language,
            "author": summary.author,
            "quality_score": round(summary.quality_score, 3),
            "completeness_score": round(summary.completeness_score, 3),
            "health_score": round(summary.health_score, 3),
        },
    )
    render_result(details)

    if verbose and summary.description:
        console.print(f"\n[bold]Description[/bold]\n{summary.description}")

    if metadata_only or not summary.entries:
        return

    table = Table(show_header=True, header_style="bold cyan")
    table.add_column("Title")
    table.add_column("Author")
    table.add_column("Published")
    for entry in summary.entries:
        table.add_row(
            entry.get("title", "Untitled"),
            entry.get("author") or "-",
            entry.get("published") or "-",
        )
    console.print("\n[bold]Recent entries[/bold]")
    console.print(table)


def _store_fetch_log(
    db: DatabaseManager, feed_id: str, summary: FetchSummary, *, saved_items: int
) -> None:
    """Persist fetch metadata for stored feeds."""
    db.add_feed_fetch_log(
        FeedFetchLog(
            feed_source_id=feed_id,
            fetch_url=summary.url,
            success=True,
            status_code=summary.status_code,
            content_type=summary.content_type,
            content_length=summary.content_length,
            items_found=summary.entry_count,
            items_new=saved_items,
            fetch_duration_ms=summary.duration_ms,
            extra_data={
                "title": summary.title,
                "language": summary.language,
                "quality_score": round(summary.quality_score, 3),
                "completeness_score": round(summary.completeness_score, 3),
                "health_score": round(summary.health_score, 3),
            },
        )
    )


def _store_feed_items(db: DatabaseManager, feed_id: str, entries: list[dict[str, Any]]) -> int:
    """Persist fetched entry previews as feed items when possible."""
    saved_count = 0
    for entry in entries:
        try:
            db.add_feed_item(
                FeedItem(
                    feed_source_id=feed_id,
                    guid=entry.get("link") or entry.get("title"),
                    title=entry.get("title"),
                    link=entry.get("link"),
                    author=entry.get("author"),
                    published=datetime.fromisoformat(entry["published"])
                    if entry.get("published")
                    else None,
                )
            )
            saved_count += 1
        except Exception as exc:
            logger.warning(f"Could not store fetched entry: {exc}")
    return saved_count


@app.command("url")
def fetch_url(
    feed_url: str = typer.Argument(..., help="Feed URL to fetch"),
    timeout: float = typer.Option(
        30.0,
        "--timeout",
        "-t",
        help="Request timeout in seconds",
    ),
    format: ResultFormat = typer.Option(
        ResultFormat.TEXT,
        "--format",
        "-f",
        help="Summary output format",
        case_sensitive=False,
    ),
    metadata_only: bool = typer.Option(
        False,
        "--metadata-only",
        help="Skip entry previews and only show feed metadata",
    ),
    verbose: bool = typer.Option(
        False,
        "--verbose",
        "-v",
        help="Show additional metadata fields",
    ),
) -> None:
    """Fetch a raw feed URL and preview metadata."""
    try:
        summary = asyncio.run(
            _fetch_summary(feed_url, timeout=timeout, include_entries=not metadata_only)
        )
    except httpx.HTTPError as exc:
        render_result(
            CommandResult(
                status="error",
                summary="Feed fetch failed",
                details={"url": feed_url, "error": str(exc)},
            ),
            format=format,
        )
        raise typer.Exit(code=int(ExitCode.VALIDATION_ERROR)) from exc
    except Exception as exc:
        logger.exception("Unexpected fetch error")
        render_result(
            CommandResult(
                status="error",
                summary="Feed fetch failed",
                details={"url": feed_url, "error": str(exc)},
            ),
            format=format,
        )
        raise typer.Exit(code=int(ExitCode.RUNTIME_ERROR)) from exc

    if format == ResultFormat.JSON:
        console.print(json.dumps(summary.to_dict(), indent=2, sort_keys=True, default=str))
        return
    _print_fetch_text(summary, metadata_only=metadata_only, verbose=verbose)


@app.command("one")
def fetch_one(
    feed_id: str = typer.Argument(..., help="Feed ID to fetch"),
    db_path: str = typer.Option(
        DEFAULT_DATABASE_URL,
        "--database",
        "-d",
        help="Database URL (defaults to AIWF_DATABASE_URL)",
    ),
    timeout: float = typer.Option(
        30.0,
        "--timeout",
        "-t",
        help="Request timeout in seconds",
    ),
    format: ResultFormat = typer.Option(
        ResultFormat.TEXT,
        "--format",
        "-f",
        help="Summary output format",
        case_sensitive=False,
    ),
    metadata_only: bool = typer.Option(
        False,
        "--metadata-only",
        help="Skip entry previews and only show feed metadata",
    ),
    verbose: bool = typer.Option(
        False,
        "--verbose",
        "-v",
        help="Show additional metadata fields",
    ),
) -> None:
    """Fetch a stored feed by ID."""
    database_url = resolve_runtime_database_url(database_url)
    db = DatabaseManager(database_url)
    feed = db.get_feed_source(feed_id)
    if feed is None or not feed.feed:
        render_result(
            CommandResult(
                status="error",
                summary=f"Stored feed '{feed_id}' was not found",
                details={"database": database_url},
            ),
            format=format,
        )
        raise typer.Exit(code=int(ExitCode.VALIDATION_ERROR))

    try:
        summary = asyncio.run(
            _fetch_summary(feed.feed, timeout=timeout, include_entries=not metadata_only)
        )
        saved_items = _store_feed_items(db, feed_id, summary.entries) if summary.entries else 0
        _store_fetch_log(db, feed_id, summary, saved_items=saved_items)
    except httpx.HTTPError as exc:
        render_result(
            CommandResult(
                status="error",
                summary="Stored feed fetch failed",
                details={"feed_id": feed_id, "url": feed.feed, "error": str(exc)},
            ),
            format=format,
        )
        raise typer.Exit(code=int(ExitCode.VALIDATION_ERROR)) from exc
    except Exception as exc:
        logger.exception("Unexpected stored-feed fetch error")
        render_result(
            CommandResult(
                status="error",
                summary="Stored feed fetch failed",
                details={"feed_id": feed_id, "url": feed.feed, "error": str(exc)},
            ),
            format=format,
        )
        raise typer.Exit(code=int(ExitCode.RUNTIME_ERROR)) from exc

    if format == ResultFormat.JSON:
        payload = summary.to_dict()
        payload["database"] = database_url
        payload["feed_id"] = feed_id
        payload["saved_items"] = saved_items
        console.print(json.dumps(payload, indent=2, sort_keys=True, default=str))
        return

    _print_fetch_text(summary, metadata_only=metadata_only, verbose=verbose)
    if not metadata_only:
        console.print(f"\n[green]Saved {saved_items} fetched entries to the database[/green]")


@app.command("all")
def fetch_all(
    db_path: str = typer.Option(
        DEFAULT_DATABASE_URL,
        "--database",
        "-d",
        help="Database URL (defaults to AIWF_DATABASE_URL)",
    ),
    limit: int | None = typer.Option(
        None,
        "--limit",
        "-l",
        help="Maximum number of feeds to fetch",
    ),
    verified_only: bool = typer.Option(
        False,
        "--verified-only",
        help="Only fetch verified feeds",
    ),
    timeout: float = typer.Option(
        30.0,
        "--timeout",
        "-t",
        help="Request timeout in seconds",
    ),
    format: ResultFormat = typer.Option(
        ResultFormat.TEXT,
        "--format",
        "-f",
        help="Summary output format",
        case_sensitive=False,
    ),
) -> None:
    """Fetch all stored feeds and record fetch logs."""
    database_url = resolve_runtime_database_url(database_url)
    db = DatabaseManager(database_url)
    feeds = db.get_all_feed_sources()
    if verified_only:
        feeds = [feed for feed in feeds if getattr(feed, "verified", False)]
    if limit is not None:
        feeds = feeds[:limit]

    success_count = 0
    failure_count = 0
    saved_items = 0
    failures: list[str] = []

    for feed in feeds:
        if not getattr(feed, "feed", None):
            continue
        try:
            summary = asyncio.run(_fetch_summary(feed.feed, timeout=timeout, include_entries=True))
            new_items = _store_feed_items(db, feed.id, summary.entries)
            _store_fetch_log(db, feed.id, summary, saved_items=new_items)
            success_count += 1
            saved_items += new_items
        except Exception as exc:
            failure_count += 1
            failures.append(f"{feed.id}: {exc}")
            logger.warning(f"Failed to fetch {feed.id}: {exc}")

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        for feed in feeds:
            if not feed.feed:
                continue

            task = progress.add_task(f"Fetching {feed.title}...", total=None)

            try:
                fetch_log, metadata, items = asyncio.run(fetcher.fetch_feed(feed.feed))

                if fetch_log.success:
                    results["success"] += 1
                    results["total_items"] += len(items)

                    # Save to database
                    fetch_log.feed_source_id = feed.id
                    db.add_feed_fetch_log(fetch_log)

                    # Save items
                    for item in items:
                        item.feed_source_id = feed.id
                        try:
                            db.add_feed_item(item)
                        except IntegrityError:
                            logger.debug(f"Skipping duplicate item for feed {feed.id}")

                else:
                    results["failed"] += 1

            except Exception as e:
                results["failed"] += 1
                logger.error(f"Error fetching {feed.title}: {e}")

            progress.update(task, completed=True)

    # Results summary
    console.print("\n[bold cyan]📊 Fetch Results:[/bold cyan]\n")

    results_table = Table(box=box.ROUNDED)
    results_table.add_column("Metric", style="cyan")
    results_table.add_column("Value", style="green", justify="right")

    results_table.add_row("Total Feeds", str(len(feeds)))
    results_table.add_row("Successful", str(results["success"]))
    results_table.add_row("Failed", str(results["failed"]))
    results_table.add_row(
        "Success Rate", f"{results['success'] / len(feeds) * 100:.1f}%" if feeds else "0%"
    )
    render_result(result, format=format)

    if failures:
        raise typer.Exit(code=int(ExitCode.VALIDATION_ERROR))

"""ai_web_feeds.cli.commands.fetch -- Fetch feeds through the current polling pipeline."""

import asyncio

import typer
from ai_web_feeds.config import DEFAULT_DATABASE_URL, Settings
from ai_web_feeds.models import CurationStatus, FeedSource
from ai_web_feeds.polling import FeedPoller
from ai_web_feeds.storage import DatabaseManager, upgrade_database_to_head
from loguru import logger
from rich import box
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table

app = typer.Typer(help="Fetch feeds and publish discovered articles")
console = Console()


@app.command("one")
def fetch_one(
    feed_id: str = typer.Argument(..., help="Feed ID to fetch"),
    db_path: str = typer.Option(
        DEFAULT_DATABASE_URL,
        "--database",
        "-d",
        help="Database URL",
    ),
) -> None:
    """Fetch a single feed and store discovered articles."""
    upgrade_database_to_head(db_path)
    db = DatabaseManager(db_path)
    feed = db.get_feed_source(feed_id)
    if not feed:
        console.print(f"[red]Error: Feed '{feed_id}' not found[/red]")
        raise typer.Exit(1)

    if not feed.feed:
        console.print(f"[red]Error: Feed '{feed_id}' has no feed URL[/red]")
        raise typer.Exit(1)

    try:
        job = asyncio.run(_poll_one(db, feed))
    except Exception as exc:
        console.print(f"[red]✗ Fetch failed: {exc}[/red]")
        logger.exception("Single feed fetch failed")
        raise typer.Exit(1) from exc

    console.print("[green]✓ Fetch successful[/green]\n")
    _print_job_summary(
        "Fetch Summary",
        {
            "Feed ID": feed.id,
            "Status": job.status.value,
            "Articles Discovered": str(job.articles_discovered),
            "Response Time": f"{job.response_time_ms or 0} ms",
        },
    )


@app.command("all")
def fetch_all(
    db_path: str = typer.Option(
        DEFAULT_DATABASE_URL,
        "--database",
        "-d",
        help="Database URL",
    ),
    limit: int | None = typer.Option(
        None,
        "--limit",
        "-l",
        help="Limit number of feeds to fetch",
    ),
    verified_only: bool = typer.Option(
        False,
        "--verified-only",
        help="Only fetch verified feeds",
    ),
) -> None:
    """Fetch feed sources and store discovered articles."""
    upgrade_database_to_head(db_path)
    db = DatabaseManager(db_path)
    feeds = _select_feeds(db.get_all_feed_sources(), limit=limit, verified_only=verified_only)

    if not feeds:
        console.print("[yellow]No feed sources matched the fetch criteria[/yellow]")
        return

    results = asyncio.run(_poll_many(db, feeds))
    console.print("\n[bold cyan]Fetch Results[/bold cyan]\n")
    _print_job_summary(
        "Fetch Results",
        {
            "Total Feeds": str(len(feeds)),
            "Successful": str(results["success"]),
            "Failed": str(results["failed"]),
            "Success Rate": (f"{results['success'] / len(feeds) * 100:.1f}%" if feeds else "0%"),
            "Articles Discovered": str(results["articles_discovered"]),
        },
    )


def _select_feeds(
    feeds: list[FeedSource],
    *,
    limit: int | None,
    verified_only: bool,
) -> list[FeedSource]:
    selected = [
        feed
        for feed in feeds
        if feed.feed
        and feed.curation_status not in {CurationStatus.ARCHIVED, CurationStatus.INACTIVE}
    ]
    if verified_only:
        selected = [feed for feed in selected if feed.verified]
    selected = sorted(selected, key=lambda feed: feed.id)
    return selected[:limit] if limit else selected


async def _poll_one(db: DatabaseManager, feed: FeedSource):
    settings = Settings()
    poller = FeedPoller(db, settings)
    return await poller.poll_feed(feed.id, feed.feed or "")


async def _poll_many(db: DatabaseManager, feeds: list[FeedSource]) -> dict[str, int]:
    settings = Settings()
    poller = FeedPoller(db, settings)
    results = {"success": 0, "failed": 0, "articles_discovered": 0}

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        for feed in feeds:
            task = progress.add_task(f"Fetching {feed.title}...", total=None)
            try:
                job = await poller.poll_feed(feed.id, feed.feed or "")
            except Exception as exc:
                results["failed"] += 1
                logger.warning("Feed fetch failed for {}: {}", feed.id, exc)
            else:
                results["success"] += 1
                results["articles_discovered"] += job.articles_discovered
            finally:
                progress.update(task, completed=True)

    return results


def _print_job_summary(title: str, rows: dict[str, str]) -> None:
    table = Table(title=title, box=box.ROUNDED)
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="green", justify="right")
    for metric, value in rows.items():
        table.add_row(metric, value)
    console.print(table)

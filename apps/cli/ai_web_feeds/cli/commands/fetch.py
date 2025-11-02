"""ai_web_feeds.cli.commands.fetch -- Fetch feeds with enhanced metadata extraction"""

import asyncio

import typer
from loguru import logger
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table
from rich import box

from ai_web_feeds.fetcher import AdvancedFeedFetcher
from ai_web_feeds.storage import DatabaseManager

app = typer.Typer(help="Fetch feeds with enhanced metadata extraction")
console = Console()


@app.command("one")
def fetch_one(
    feed_id: str = typer.Argument(..., help="Feed ID to fetch"),
    db_path: str = typer.Option(
        "sqlite:///data/aiwebfeeds.db",
        "--database",
        "-d",
        help="Database URL",
    ),
    show_metadata: bool = typer.Option(
        False,
        "--metadata",
        "-m",
        help="Show detailed metadata",
    ),
):
    """Fetch a single feed and extract metadata."""
    db = DatabaseManager(db_path)

    # Get feed source
    feed = db.get_feed_source(feed_id)
    if not feed:
        console.print(f"[red]Error: Feed '{feed_id}' not found[/red]")
        raise typer.Exit(1)

    if not feed.feed:
        console.print(f"[red]Error: Feed '{feed_id}' has no feed URL[/red]")
        raise typer.Exit(1)

    console.print(f"\n[bold cyan]🔄 Fetching feed: {feed.title}[/bold cyan]")
    console.print(f"[dim]URL: {feed.feed}[/dim]\n")

    # Fetch with progress
    fetcher = AdvancedFeedFetcher()

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task = progress.add_task("Fetching and analyzing...", total=None)

        try:
            fetch_log, metadata, items = asyncio.run(fetcher.fetch_feed(feed.feed))
            progress.update(task, completed=True)

        except Exception as e:
            progress.update(task, completed=True)
            console.print(f"[red]✗ Error: {e}[/red]")
            raise typer.Exit(1)

    # Display results
    if fetch_log.success:
        console.print("[green]✓ Fetch successful[/green]\n")

        # Summary table
        summary_table = Table(title="Fetch Summary", box=box.ROUNDED)
        summary_table.add_column("Metric", style="cyan")
        summary_table.add_column("Value", style="green", justify="right")

        summary_table.add_row("Status Code", str(fetch_log.status_code))
        summary_table.add_row("Content Type", fetch_log.content_type or "N/A")
        summary_table.add_row(
            "Content Size",
            f"{fetch_log.content_length:,} bytes" if fetch_log.content_length else "N/A",
        )
        summary_table.add_row("Duration", f"{fetch_log.fetch_duration_ms} ms")
        summary_table.add_row("Items Found", str(len(items)))

        console.print(summary_table)

        # Metadata summary
        metadata_table = Table(title="Feed Metadata", box=box.ROUNDED)
        metadata_table.add_column("Field", style="cyan")
        metadata_table.add_column("Value", style="yellow")

        metadata_table.add_row("Title", metadata.title or "N/A")
        metadata_table.add_row(
            "Description",
            (metadata.description[:100] + "...")
            if metadata.description and len(metadata.description) > 100
            else (metadata.description or "N/A"),
        )
        metadata_table.add_row("Language", metadata.language or "N/A")
        metadata_table.add_row("Author", metadata.author or "N/A")
        metadata_table.add_row("Total Items", str(metadata.total_items))
        metadata_table.add_row("Update Frequency", metadata.estimated_update_frequency or "N/A")

        console.print(metadata_table)

        # Quality scores
        quality_table = Table(title="Quality Scores", box=box.ROUNDED)
        quality_table.add_column("Metric", style="cyan")
        quality_table.add_column("Score", style="magenta", justify="right")

        quality_table.add_row("Completeness", f"{metadata.completeness_score:.3f}")
        quality_table.add_row("Richness", f"{metadata.richness_score:.3f}")
        quality_table.add_row("Structure", f"{metadata.structure_score:.3f}")

        console.print(quality_table)

        # Show detailed metadata if requested
        if show_metadata:
            console.print("\n[bold cyan]📊 Detailed Metadata:[/bold cyan]\n")
            import json

            console.print(json.dumps(metadata.to_dict(), indent=2, default=str))

        # Save to database
        fetch_log.feed_source_id = feed_id
        db.add_feed_fetch_log(fetch_log)

        # Save items
        saved_count = 0
        for item in items:
            item.feed_source_id = feed_id
            try:
                db.add_feed_item(item)
                saved_count += 1
            except Exception as e:
                logger.warning(f"Could not save item: {e}")

        console.print(f"\n[green]✓ Saved {saved_count} items to database[/green]")

    else:
        console.print("[red]✗ Fetch failed[/red]\n")
        console.print(f"[red]Error: {fetch_log.error_message}[/red]")
        console.print(f"[dim]Type: {fetch_log.error_type}[/dim]")


@app.command("all")
def fetch_all(
    db_path: str = typer.Option(
        "sqlite:///data/aiwebfeeds.db",
        "--database",
        "-d",
        help="Database URL",
    ),
    limit: int = typer.Option(
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
):
    """Fetch all feeds and extract metadata."""
    db = DatabaseManager(db_path)

    feeds = db.get_all_feed_sources()

    if verified_only:
        feeds = [f for f in feeds if f.verified]

    if limit:
        feeds = feeds[:limit]

    console.print(f"\n[bold cyan]🔄 Fetching {len(feeds)} feeds...[/bold cyan]\n")

    fetcher = AdvancedFeedFetcher()
    results = {"success": 0, "failed": 0, "total_items": 0}

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
                        except Exception:
                            pass  # Skip duplicates

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
    results_table.add_row("Total Items Fetched", str(results["total_items"]))

    console.print(results_table)

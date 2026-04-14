"""CLI commands for corpus refresh and export."""

from __future__ import annotations

import asyncio
from pathlib import Path

import typer
from ai_web_feeds.config import DEFAULT_ARTICLE_CORPUS_PATH, DEFAULT_DATABASE_URL, Settings
from ai_web_feeds.polling import FeedPoller
from ai_web_feeds.storage import DatabaseManager
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

app = typer.Typer(help="Refresh and export the generated article corpus")
console = Console()


@app.command("export")
def export_corpus(
    database_url: str = typer.Option(
        DEFAULT_DATABASE_URL,
        "--database-url",
        "-d",
        help="Database URL",
    ),
    output_file: Path = typer.Option(
        DEFAULT_ARTICLE_CORPUS_PATH,
        "--output",
        "-o",
        help="Generated corpus artifact path",
    ),
) -> None:
    """Export the generated article corpus from stored feed entries."""
    try:
        db = DatabaseManager(database_url)
        db.create_db_and_tables()

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            progress.add_task(description="Building corpus artifact...", total=None)
            payload = db.export_articles_corpus(output_file)

        metadata = payload["metadata"]
        console.print(
            f"[green]✓[/green] Exported {metadata['article_count']} articles "
            f"from {metadata['feed_count']} feeds to {output_file}"
        )
        if metadata.get("latest_published_at"):
            console.print(f"[dim]Latest published at: {metadata['latest_published_at']}[/dim]")

    except FileNotFoundError as exc:
        console.print(f"[red]✗[/red] File not found: {exc}")
        raise typer.Exit(code=1) from exc
    except Exception as exc:
        console.print(f"[red]✗[/red] Corpus export failed: {exc}")
        raise typer.Exit(code=1) from exc


@app.command("refresh")
def refresh_corpus(
    database_url: str = typer.Option(
        DEFAULT_DATABASE_URL,
        "--database-url",
        "-d",
        help="Database URL",
    ),
    output_file: Path = typer.Option(
        DEFAULT_ARTICLE_CORPUS_PATH,
        "--output",
        "-o",
        help="Generated corpus artifact path",
    ),
) -> None:
    """Poll active feeds, persist articles, and export the corpus artifact."""
    try:
        db = DatabaseManager(database_url)
        db.create_db_and_tables()
        settings = Settings()
        poller = FeedPoller(db, settings)

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            progress.add_task(description="Refreshing feed corpus...", total=None)
            summary = asyncio.run(poller.refresh_corpus())
            payload = db.export_articles_corpus(
                output_file,
                partial_coverage=summary["partial_coverage"],
            )

        metadata = payload["metadata"]
        console.print(
            f"[green]✓[/green] Refreshed {summary['successful_feeds']}/{summary['attempted_feeds']} "
            f"feeds and exported {metadata['article_count']} articles to {output_file}"
        )
        if summary["failed_feeds"] > 0:
            console.print(
                "[yellow]⚠[/yellow] Partial refresh completed: "
                f"{summary['failed_feeds']} feeds failed "
                f"({', '.join(summary['failed_feed_ids'])})"
            )
            raise typer.Exit(code=1)

    except FileNotFoundError as exc:
        console.print(f"[red]✗[/red] File not found: {exc}")
        raise typer.Exit(code=1) from exc
    except Exception as exc:
        console.print(f"[red]✗[/red] Corpus refresh failed: {exc}")
        raise typer.Exit(code=1) from exc

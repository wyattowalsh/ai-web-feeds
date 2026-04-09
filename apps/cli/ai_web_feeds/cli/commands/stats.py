"""Display feed statistics."""

from __future__ import annotations

import json

import typer
from rich.table import Table

from ai_web_feeds.config import resolve_runtime_database_url
from ai_web_feeds.storage import DatabaseManager
from ai_web_feeds.cli.support import StatsFormat, console

app = typer.Typer(help="Display feed statistics", invoke_without_command=True)
cli = app


@app.callback(invoke_without_command=True)
def callback(
    ctx: typer.Context,
    database_url: str | None = typer.Option(
        None,
        "--database",
        "-d",
        help="Database URL (defaults to AIWF_DATABASE_URL)",
    ),
    format: StatsFormat = typer.Option(
        StatsFormat.TABLE,
        "--format",
        "-f",
        help="Summary output format",
        case_sensitive=False,
    ),
) -> None:
    """Support ``ai-web-feeds stats`` as an alias for ``stats show``."""
    if ctx.invoked_subcommand is not None:
        return
    show(database_url=database_url, format=format)


@app.command()
def show(
    database_url: str | None = typer.Option(
        None,
        "--database",
        "-d",
        help="Database URL (defaults to AIWF_DATABASE_URL)",
    ),
    format: StatsFormat = typer.Option(
        StatsFormat.TABLE,
        "--format",
        "-f",
        help="Summary output format",
        case_sensitive=False,
    ),
) -> None:
    """Show feed statistics."""
    database_url = resolve_runtime_database_url(database_url)
    db = DatabaseManager(database_url)
    feed_sources = db.get_all_feed_sources()

    total = len(feed_sources)
    verified = sum(1 for feed in feed_sources if getattr(feed, "verified", False))

    by_type: dict[str, int] = {}
    for feed in feed_sources:
        source_type = getattr(feed, "source_type", None)
        if source_type is not None:
            key = getattr(source_type, "value", str(source_type))
            by_type[key] = by_type.get(key, 0) + 1

    payload = {
        "total_feeds": total,
        "verified_feeds": verified,
        "verified_percentage": round((verified / total * 100), 1) if total else 0.0,
        "by_source_type": dict(sorted(by_type.items(), key=lambda item: (-item[1], item[0]))),
    }

    if format == StatsFormat.JSON:
        console.print(
            json.dumps({"status": "success", "summary": "Feed statistics", "details": payload})
        )
        return

    console.print("\n📊 Feed Statistics")
    console.print("═" * 50)
    console.print(f"Total Feeds: {payload['total_feeds']}")
    console.print(f"Verified: {payload['verified_feeds']} ({payload['verified_percentage']:.1f}%)")

    if not by_type:
        console.print("No feed sources found")
        console.print("═" * 50)
        return

    table = Table(show_header=True, header_style="bold cyan")
    table.add_column("Source Type")
    table.add_column("Count", justify="right")
    for source_type, count in payload["by_source_type"].items():
        table.add_row(source_type, str(count))
    console.print("\nBy Source Type:")
    console.print(table)
    console.print("═" * 50)

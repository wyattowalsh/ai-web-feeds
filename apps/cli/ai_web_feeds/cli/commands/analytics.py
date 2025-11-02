"""CLI commands for analytics dashboard."""

from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table

from ai_web_feeds.analytics import (
    calculate_summary_metrics,
    export_analytics_csv,
    generate_analytics_snapshot,
    get_publication_velocity,
    get_trending_topics,
)
from ai_web_feeds.storage import DatabaseManager

app = typer.Typer(help="Analytics dashboard commands")
console = Console()


@app.command("summary")
def analytics_summary(
    database_url: str = typer.Option(
        "sqlite:///data/aiwebfeeds.db",
        "--database-url",
        "-d",
        help="Database URL",
    ),
    date_range: str = typer.Option(
        "30d",
        "--date-range",
        "-r",
        help="Date range: 7d, 30d, 90d",
    ),
    topic: Optional[str] = typer.Option(
        None,
        "--topic",
        "-t",
        help="Filter by topic ID",
    ),
):
    """Display analytics summary metrics."""
    console.print("[bold cyan]Analytics Summary[/bold cyan]\n")

    db = DatabaseManager(database_url)
    with db.get_session() as session:
        metrics = calculate_summary_metrics(session, date_range=date_range, topic=topic)

        # Summary table
        table = Table(title=f"Summary Metrics ({date_range})", show_header=True)
        table.add_column("Metric", style="cyan")
        table.add_column("Value", style="green")

        table.add_row("Total Feeds", str(metrics["total_feeds"]))
        table.add_row("Active Feeds", str(metrics["active_feeds"]))
        table.add_row(
            "Validation Success Rate",
            f"{metrics['validation_success_rate']:.2%}",
        )
        table.add_row(
            "Avg Response Time",
            f"{metrics['avg_response_time']:.2f} ms",
        )

        console.print(table)

        # Health distribution
        health_table = Table(title="Feed Health Distribution", show_header=True)
        health_table.add_column("Category", style="cyan")
        health_table.add_column("Count", style="green")

        for category, count in metrics["health_distribution"].items():
            health_table.add_row(category.capitalize(), str(count))

        console.print("\n")
        console.print(health_table)

    console.print("\n[green]✓[/green] Summary complete")


@app.command("trending")
def analytics_trending(
    database_url: str = typer.Option(
        "sqlite:///data/aiwebfeeds.db",
        "--database-url",
        "-d",
        help="Database URL",
    ),
    limit: int = typer.Option(
        10,
        "--limit",
        "-l",
        help="Number of topics to show",
    ),
    date_range: str = typer.Option(
        "30d",
        "--date-range",
        "-r",
        help="Date range: 7d, 30d, 90d",
    ),
):
    """Display Most Active Topics."""
    console.print("[bold cyan]Most Active Topics[/bold cyan]\n")

    db = DatabaseManager(database_url)
    with db.get_session() as session:
        topics = get_trending_topics(session, limit=limit, date_range=date_range)

        if not topics:
            console.print(
                "[yellow]No topic stats found. Run 'aiwebfeeds analytics snapshot' first.[/yellow]"
            )
            raise typer.Exit(1)

        table = Table(show_header=True)
        table.add_column("Rank", style="dim")
        table.add_column("Topic", style="cyan")
        table.add_column("Feeds", style="green", justify="right")
        table.add_column("Validation Freq", style="yellow", justify="right")
        table.add_column("Avg Health", style="magenta", justify="right")

        for idx, topic in enumerate(topics, 1):
            table.add_row(
                str(idx),
                topic["topic"],
                str(topic["feed_count"]),
                f"{topic['validation_frequency']:.2f}",
                f"{topic['avg_health_score']:.2f}",
            )

        console.print(table)

    console.print(f"\n[green]✓[/green] Top {len(topics)} topics displayed")


@app.command("velocity")
def analytics_velocity(
    database_url: str = typer.Option(
        "sqlite:///data/aiwebfeeds.db",
        "--database-url",
        "-d",
        help="Database URL",
    ),
    granularity: str = typer.Option(
        "daily",
        "--granularity",
        "-g",
        help="Granularity: daily, weekly, monthly",
    ),
    date_range: str = typer.Option(
        "30d",
        "--date-range",
        "-r",
        help="Date range: 7d, 30d, 90d",
    ),
):
    """Display publication velocity metrics."""
    console.print(f"[bold cyan]Publication Velocity ({granularity})[/bold cyan]\n")

    db = DatabaseManager(database_url)
    with db.get_session() as session:
        velocity = get_publication_velocity(session, granularity=granularity, date_range=date_range)

        console.print(f"[bold]Average per feed:[/bold] {velocity['avg_per_feed']:.2f} validations")

        if velocity["most_active_feed"]:
            console.print(
                f"[bold]Most active:[/bold] {velocity['most_active_feed']['title']} "
                f"({velocity['most_active_feed']['count']} validations)"
            )

        if velocity["least_active_feed"]:
            console.print(
                f"[bold]Least active:[/bold] {velocity['least_active_feed']['title']} "
                f"({velocity['least_active_feed']['count']} validations)"
            )

        # Data points table
        console.print(f"\n[bold]Validation counts by {granularity}:[/bold]\n")

        table = Table(show_header=True)
        table.add_column("Date", style="cyan")
        table.add_column("Validations", style="green", justify="right")

        for dp in velocity["data_points"][-20:]:  # Show last 20 data points
            table.add_row(dp["date"], str(dp["count"]))

        console.print(table)

    console.print("\n[green]✓[/green] Velocity data displayed")


@app.command("snapshot")
def analytics_snapshot(
    database_url: str = typer.Option(
        "sqlite:///data/aiwebfeeds.db",
        "--database-url",
        "-d",
        help="Database URL",
    ),
):
    """Generate daily analytics snapshot."""
    console.print("[bold cyan]Generating Analytics Snapshot[/bold cyan]\n")

    db = DatabaseManager(database_url)
    with db.get_session() as session:
        snapshot = generate_analytics_snapshot(session)

        console.print(f"[green]✓[/green] Snapshot created for {snapshot.snapshot_date}")
        console.print(f"  Total feeds: {snapshot.total_feeds}")
        console.print(f"  Active feeds: {snapshot.active_feeds}")
        console.print(f"  Success rate: {snapshot.validation_success_rate:.2%}")
        console.print(f"  Avg response time: {snapshot.avg_response_time:.2f} ms")


@app.command("export")
def analytics_export(
    database_url: str = typer.Option(
        "sqlite:///data/aiwebfeeds.db",
        "--database-url",
        "-d",
        help="Database URL",
    ),
    output: Path = typer.Option(
        "analytics_export.csv",
        "--output",
        "-o",
        help="Output CSV file path",
    ),
    date_range: str = typer.Option(
        "30d",
        "--date-range",
        "-r",
        help="Date range: 7d, 30d, 90d",
    ),
):
    """Export analytics to CSV."""
    console.print("[bold cyan]Exporting Analytics to CSV[/bold cyan]\n")

    db = DatabaseManager(database_url)
    with db.get_session() as session:
        csv_content = export_analytics_csv(session, date_range=date_range)

        # Write to file
        output.write_text(csv_content)

        console.print(f"[green]✓[/green] Exported to {output}")
        console.print(f"  Size: {len(csv_content)} bytes")
        console.print(f"  Date range: {date_range}")

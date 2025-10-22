"""ai_web_feeds.cli.commands.analytics -- Display comprehensive feed analytics"""

import json
from pathlib import Path

import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.layout import Layout
from rich import box

from ai_web_feeds.analytics import FeedAnalytics
from ai_web_feeds.storage import DatabaseManager

app = typer.Typer(help="Display comprehensive feed analytics")
console = Console()


@app.command("overview")
def show_overview(
    db_path: str = typer.Option(
        "sqlite:///data/aiwebfeeds.db",
        "--database",
        "-d",
        help="Database URL",
    ),
):
    """Show overview analytics dashboard."""
    db = DatabaseManager(db_path)
    analytics = FeedAnalytics(db.get_session())

    stats = analytics.get_overview_stats()

    # Create layout
    console.print("\n[bold cyan]📊 Feed Analytics Overview[/bold cyan]\n")

    # Totals table
    totals_table = Table(title="Totals", box=box.ROUNDED)
    totals_table.add_column("Metric", style="cyan")
    totals_table.add_column("Count", style="green", justify="right")

    for key, value in stats["totals"].items():
        totals_table.add_row(key.title(), str(value))

    console.print(totals_table)

    # Status table
    status_table = Table(title="Feed Status", box=box.ROUNDED)
    status_table.add_column("Status", style="cyan")
    status_table.add_column("Count", style="yellow", justify="right")

    for key, value in stats["feed_status"].items():
        status_table.add_row(key.title(), str(value))

    console.print(status_table)

    # Recent activity
    activity_table = Table(title="Recent Activity (24h)", box=box.ROUNDED)
    activity_table.add_column("Activity", style="cyan")
    activity_table.add_column("Count", style="magenta", justify="right")

    for key, value in stats["recent_activity_24h"].items():
        activity_table.add_row(key.replace("_", " ").title(), str(value))

    console.print(activity_table)


@app.command("distributions")
def show_distributions(
    db_path: str = typer.Option(
        "sqlite:///data/aiwebfeeds.db",
        "--database",
        "-d",
        help="Database URL",
    ),
    limit: int = typer.Option(10, "--limit", "-l", help="Number of items to show"),
):
    """Show distribution analytics."""
    db = DatabaseManager(db_path)
    analytics = FeedAnalytics(db.get_session())

    console.print("\n[bold cyan]📈 Distribution Analytics[/bold cyan]\n")

    # Source types
    source_types = analytics.get_source_type_distribution()
    types_table = Table(title="Source Types", box=box.ROUNDED)
    types_table.add_column("Type", style="cyan")
    types_table.add_column("Count", style="green", justify="right")
    types_table.add_column("Percentage", style="yellow", justify="right")

    total = sum(source_types.values())
    for type_name, count in list(source_types.items())[:limit]:
        percentage = (count / total * 100) if total > 0 else 0
        types_table.add_row(type_name, str(count), f"{percentage:.1f}%")

    console.print(types_table)

    # Topics
    topics = analytics.get_topic_distribution()
    topics_table = Table(title="Top Topics", box=box.ROUNDED)
    topics_table.add_column("Topic", style="cyan")
    topics_table.add_column("Feeds", style="green", justify="right")

    for topic, count in list(topics.items())[:limit]:
        topics_table.add_row(topic, str(count))

    console.print(topics_table)

    # Languages
    languages = analytics.get_language_distribution()
    lang_table = Table(title="Languages", box=box.ROUNDED)
    lang_table.add_column("Language", style="cyan")
    lang_table.add_column("Count", style="green", justify="right")

    for lang, count in list(languages.items())[:limit]:
        lang_table.add_row(lang, str(count))

    console.print(lang_table)


@app.command("quality")
def show_quality(
    db_path: str = typer.Option(
        "sqlite:///data/aiwebfeeds.db",
        "--database",
        "-d",
        help="Database URL",
    ),
):
    """Show quality metrics."""
    db = DatabaseManager(db_path)
    analytics = FeedAnalytics(db.get_session())

    metrics = analytics.get_quality_metrics()

    console.print("\n[bold cyan]⭐ Quality Metrics[/bold cyan]\n")

    # Summary
    summary_table = Table(box=box.ROUNDED)
    summary_table.add_column("Metric", style="cyan")
    summary_table.add_column("Value", style="green", justify="right")

    summary_table.add_row("Average Quality", f"{metrics['average_quality']:.3f}")
    summary_table.add_row("Median Quality", f"{metrics['median_quality']:.3f}")
    summary_table.add_row("High Quality Feeds (≥0.8)", str(metrics['high_quality_count']))
    summary_table.add_row("Low Quality Feeds (<0.5)", str(metrics['low_quality_count']))

    console.print(summary_table)

    # Distribution
    dist_table = Table(title="Quality Distribution", box=box.ROUNDED)
    dist_table.add_column("Range", style="cyan")
    dist_table.add_column("Count", style="yellow", justify="right")

    for range_name, count in metrics['quality_distribution'].items():
        dist_table.add_row(range_name, str(count))

    console.print(dist_table)


@app.command("performance")
def show_performance(
    db_path: str = typer.Option(
        "sqlite:///data/aiwebfeeds.db",
        "--database",
        "-d",
        help="Database URL",
    ),
    days: int = typer.Option(7, "--days", help="Number of days to analyze"),
):
    """Show fetch performance statistics."""
    db = DatabaseManager(db_path)
    analytics = FeedAnalytics(db.get_session())

    stats = analytics.get_fetch_performance_stats(days=days)

    console.print(f"\n[bold cyan]⚡ Fetch Performance ({days} days)[/bold cyan]\n")

    # Summary
    summary_table = Table(box=box.ROUNDED)
    summary_table.add_column("Metric", style="cyan")
    summary_table.add_column("Value", style="green", justify="right")

    summary_table.add_row("Total Fetches", str(stats['total_fetches']))
    summary_table.add_row("Successful", f"{stats['successful_fetches']} ({stats['success_rate']}%)")
    summary_table.add_row("Failed", str(stats['failed_fetches']))
    summary_table.add_row("Avg Duration", f"{stats['avg_duration_ms']:.0f} ms")

    console.print(summary_table)

    # Error distribution
    if stats['error_distribution']:
        error_table = Table(title="Error Types", box=box.ROUNDED)
        error_table.add_column("Error Type", style="red")
        error_table.add_column("Count", style="yellow", justify="right")

        for error_type, count in stats['error_distribution'].items():
            error_table.add_row(error_type, str(count))

        console.print(error_table)

    # Status codes
    if stats['status_code_distribution']:
        status_table = Table(title="Status Codes", box=box.ROUNDED)
        status_table.add_column("Status Code", style="cyan")
        status_table.add_column("Count", style="yellow", justify="right")

        for code, count in stats['status_code_distribution'].items():
            status_table.add_row(str(code), str(count))

        console.print(status_table)


@app.command("content")
def show_content(
    db_path: str = typer.Option(
        "sqlite:///data/aiwebfeeds.db",
        "--database",
        "-d",
        help="Database URL",
    ),
):
    """Show content statistics."""
    db = DatabaseManager(db_path)
    analytics = FeedAnalytics(db.get_session())

    stats = analytics.get_content_statistics()

    console.print("\n[bold cyan]📝 Content Statistics[/bold cyan]\n")

    # Summary
    summary_table = Table(box=box.ROUNDED)
    summary_table.add_column("Metric", style="cyan")
    summary_table.add_column("Value", style="green", justify="right")

    summary_table.add_row("Total Items", str(stats['total_items']))
    summary_table.add_row("Items with Content", f"{stats['items_with_content']} ({stats['content_coverage']}%)")
    summary_table.add_row("Items with Authors", f"{stats['items_with_authors']} ({stats['author_coverage']}%)")
    summary_table.add_row("Items with Enclosures", str(stats['items_with_enclosures']))

    console.print(summary_table)

    # Top categories
    if stats['top_categories']:
        cat_table = Table(title="Top Categories", box=box.ROUNDED)
        cat_table.add_column("Category", style="cyan")
        cat_table.add_column("Count", style="yellow", justify="right")

        for category, count in list(stats['top_categories'].items())[:15]:
            cat_table.add_row(category, str(count))

        console.print(cat_table)


@app.command("trends")
def show_trends(
    db_path: str = typer.Option(
        "sqlite:///data/aiwebfeeds.db",
        "--database",
        "-d",
        help="Database URL",
    ),
    days: int = typer.Option(30, "--days", help="Number of days to analyze"),
):
    """Show publishing trends."""
    db = DatabaseManager(db_path)
    analytics = FeedAnalytics(db.get_session())

    trends = analytics.get_publishing_trends(days=days)

    console.print(f"\n[bold cyan]📊 Publishing Trends ({days} days)[/bold cyan]\n")

    # Summary
    summary_table = Table(box=box.ROUNDED)
    summary_table.add_column("Metric", style="cyan")
    summary_table.add_column("Value", style="green", justify="right")

    summary_table.add_row("Total Items Published", str(trends['total_items_published']))
    summary_table.add_row("Items Per Day", f"{trends['items_per_day']:.2f}")
    summary_table.add_row("Peak Hour", str(trends['peak_hour']) if trends['peak_hour'] is not None else "N/A")
    summary_table.add_row("Peak Weekday", trends['peak_weekday'] if trends['peak_weekday'] else "N/A")

    console.print(summary_table)

    # By weekday
    if trends['by_weekday']:
        weekday_table = Table(title="By Weekday", box=box.ROUNDED)
        weekday_table.add_column("Day", style="cyan")
        weekday_table.add_column("Count", style="yellow", justify="right")

        for day, count in trends['by_weekday'].items():
            weekday_table.add_row(day, str(count))

        console.print(weekday_table)


@app.command("health")
def show_health(
    feed_id: str = typer.Argument(..., help="Feed ID to analyze"),
    db_path: str = typer.Option(
        "sqlite:///data/aiwebfeeds.db",
        "--database",
        "-d",
        help="Database URL",
    ),
):
    """Show health report for a specific feed."""
    db = DatabaseManager(db_path)
    analytics = FeedAnalytics(db.get_session())

    report = analytics.get_feed_health_report(feed_id)

    if "error" in report:
        console.print(f"[red]Error: {report['error']}[/red]")
        raise typer.Exit(1)

    console.print(f"\n[bold cyan]🏥 Feed Health Report: {report['feed_title']}[/bold cyan]\n")

    # Health score
    health_color = {
        "excellent": "green",
        "good": "blue",
        "fair": "yellow",
        "poor": "orange",
        "critical": "red",
    }.get(report['health_status'], "white")

    console.print(
        Panel(
            f"[{health_color} bold]{report['health_status'].upper()}[/{health_color} bold]\n"
            f"Score: {report['health_score']:.3f}",
            title="Overall Health",
            border_style=health_color,
        )
    )

    # Fetch stats
    fetch_table = Table(title="Fetch Statistics", box=box.ROUNDED)
    fetch_table.add_column("Metric", style="cyan")
    fetch_table.add_column("Value", style="green", justify="right")

    for key, value in report['fetch_stats'].items():
        fetch_table.add_row(
            key.replace("_", " ").title(),
            str(value) if not (isinstance(value, float) and key == 'success_rate') else f"{value}%"
        )

    console.print(fetch_table)

    # Content stats
    content_table = Table(title="Content Statistics", box=box.ROUNDED)
    content_table.add_column("Metric", style="cyan")
    content_table.add_column("Value", style="green", justify="right")

    for key, value in report['content_stats'].items():
        content_table.add_row(
            key.replace("_", " ").title(),
            str(value) if not (isinstance(value, float) and key == 'content_coverage') else f"{value}%"
        )

    console.print(content_table)


@app.command("report")
def generate_report(
    db_path: str = typer.Option(
        "sqlite:///data/aiwebfeeds.db",
        "--database",
        "-d",
        help="Database URL",
    ),
    output: Path = typer.Option(
        None,
        "--output",
        "-o",
        help="Output file path (JSON)",
    ),
):
    """Generate comprehensive analytics report."""
    db = DatabaseManager(db_path)
    analytics = FeedAnalytics(db.get_session())

    console.print("\n[bold cyan]📊 Generating comprehensive analytics report...[/bold cyan]\n")

    report = analytics.generate_full_report()

    if output:
        output.parent.mkdir(parents=True, exist_ok=True)
        with output.open("w") as f:
            json.dump(report, f, indent=2, default=str)
        console.print(f"[green]✓ Report saved to {output}[/green]")
    else:
        console.print(json.dumps(report, indent=2, default=str))


@app.command("contributors")
def show_contributors(
    db_path: str = typer.Option(
        "sqlite:///data/aiwebfeeds.db",
        "--database",
        "-d",
        help="Database URL",
    ),
    limit: int = typer.Option(10, "--limit", "-l", help="Number of contributors to show"),
):
    """Show top contributors."""
    db = DatabaseManager(db_path)
    analytics = FeedAnalytics(db.get_session())

    contributors = analytics.get_top_contributors(limit=limit)

    console.print("\n[bold cyan]👥 Top Contributors[/bold cyan]\n")

    table = Table(box=box.ROUNDED)
    table.add_column("Rank", style="cyan", justify="right")
    table.add_column("Contributor", style="green")
    table.add_column("Feeds", style="yellow", justify="right")
    table.add_column("Verified", style="blue", justify="right")
    table.add_column("Rate", style="magenta", justify="right")

    for i, contributor in enumerate(contributors, 1):
        table.add_row(
            str(i),
            contributor['contributor'],
            str(contributor['feed_count']),
            str(contributor['verified_count']),
            f"{contributor['verification_rate']:.1f}%",
        )

    console.print(table)

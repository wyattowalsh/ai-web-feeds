"""CLI commands for AI-powered feed recommendations."""

from typing import Optional

import typer
from rich.console import Console
from rich.table import Table

from ai_web_feeds.storage import DatabaseManager
from ai_web_feeds.config import settings

app = typer.Typer(help="AI-powered feed recommendations")
console = Console()


@app.command("get")
def get_recommendations(
    database_url: str = typer.Option(
        settings.database_url,
        "--database-url",
        "-d",
        help="Database URL",
    ),
    user_id: Optional[str] = typer.Option(
        None,
        "--user-id",
        "-u",
        help="User ID for personalized recommendations",
    ),
    topics: Optional[str] = typer.Option(
        None,
        "--topics",
        "-t",
        help="Seed topics (comma-separated)",
    ),
    limit: int = typer.Option(
        20,
        "--limit",
        "-l",
        help="Maximum recommendations",
    ),
):
    """Get feed recommendations."""
    console.print("[bold cyan]AI-Powered Feed Recommendations[/bold cyan]\n")

    db = DatabaseManager(database_url)

    # Parse topics
    seed_topics = [t.strip() for t in topics.split(",")] if topics else None

    # Get recommendations
    with console.status("[bold green]Generating recommendations..."):
        if user_id:
            recommendations = db.get_user_recommendations(user_id, limit=limit)
            console.print(f"Personalized recommendations for user: [bold]{user_id}[/bold]\n")
        else:
            recommendations = db.get_recommendations(
                seed_topics=seed_topics,
                limit=limit,
            )
            if seed_topics:
                console.print(
                    f"Recommendations for topics: [bold]{', '.join(seed_topics)}[/bold]\n"
                )
            else:
                console.print("General recommendations\n")

    if not recommendations:
        console.print("[yellow]No recommendations found[/yellow]")
        return

    # Display results
    table = Table(show_header=True)
    table.add_column("Rank", style="dim", width=5)
    table.add_column("Title", style="cyan")
    table.add_column("Topics", style="green")
    table.add_column("Score", style="yellow", justify="right")
    table.add_column("Reason", style="blue")

    for idx, (feed, score, reason) in enumerate(recommendations, 1):
        topics_str = ", ".join(feed.topics[:3]) if feed.topics else "-"
        if len(feed.topics) > 3:
            topics_str += f" +{len(feed.topics) - 3}"

        reason_map = {
            "similar_topics": "Similar Topics",
            "similar_content": "Similar Content",
            "popular": "Popular",
            "discover": "Discover",
        }
        reason_label = reason_map.get(reason, reason)

        table.add_row(
            str(idx),
            feed.title[:50] if len(feed.title) > 50 else feed.title,
            topics_str,
            f"{score:.3f}",
            reason_label,
        )

    console.print(table)
    console.print(f"\n[green]✓[/green] Generated {len(recommendations)} recommendations")

    # Show breakdown
    reason_counts = {}
    for _, _, reason in recommendations:
        reason_counts[reason] = reason_counts.get(reason, 0) + 1

    console.print("\n[bold]Recommendation Breakdown:[/bold]")
    for reason, count in reason_counts.items():
        reason_map = {
            "similar_topics": "Similar Topics",
            "similar_content": "Similar Content",
            "popular": "Popular",
            "discover": "Discover",
        }
        reason_label = reason_map.get(reason, reason)
        console.print(f"  • {reason_label}: {count}")


@app.command("track")
def track_interaction(
    feed_id: str = typer.Argument(..., help="Feed ID"),
    interaction: str = typer.Argument(
        ..., help="Interaction type: view, click, subscribe, dismiss"
    ),
    database_url: str = typer.Option(
        settings.database_url,
        "--database-url",
        "-d",
        help="Database URL",
    ),
    user_id: str = typer.Option(
        "cli_user",
        "--user-id",
        "-u",
        help="User ID",
    ),
    reason: str = typer.Option(
        "unknown",
        "--reason",
        "-r",
        help="Recommendation reason",
    ),
):
    """Track recommendation interaction."""
    db = DatabaseManager(database_url)

    valid_interactions = ["view", "click", "subscribe", "dismiss"]
    if interaction not in valid_interactions:
        console.print(f"[red]Error:[/red] Invalid interaction type: {interaction}")
        console.print(f"Valid types: {', '.join(valid_interactions)}")
        return

    db.track_recommendation_click(user_id, feed_id, interaction, reason)

    console.print(f"[green]✓[/green] Tracked {interaction} interaction for feed {feed_id}")


@app.command("weights")
def show_weights(
    database_url: str = typer.Option(
        settings.database_url,
        "--database-url",
        "-d",
        help="Database URL",
    ),
):
    """Show recommendation algorithm weights."""
    console.print("[bold cyan]Recommendation Algorithm Weights[/bold cyan]\n")

    table = Table(show_header=True)
    table.add_column("Component", style="cyan")
    table.add_column("Weight", style="yellow", justify="right")
    table.add_column("Description", style="green")

    table.add_row(
        "Content Similarity",
        f"{settings.recommendation.content_weight:.0%}",
        "Topic overlap and semantic similarity",
    )
    table.add_row(
        "Popularity",
        f"{settings.recommendation.popularity_weight:.0%}",
        "Validation success rate and frequency",
    )
    table.add_row(
        "Serendipity",
        f"{settings.recommendation.serendipity_weight:.0%}",
        "Random high-quality feeds",
    )

    console.print(table)
    console.print("\n[dim]Configure weights via environment variables:[/dim]")
    console.print("  AIWF_RECOMMENDATION__CONTENT_WEIGHT")
    console.print("  AIWF_RECOMMENDATION__POPULARITY_WEIGHT")
    console.print("  AIWF_RECOMMENDATION__SERENDIPITY_WEIGHT")

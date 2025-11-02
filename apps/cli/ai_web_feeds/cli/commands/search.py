"""CLI commands for search and discovery."""

from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table

from ai_web_feeds.storage import DatabaseManager

app = typer.Typer(help="Search and discovery commands")
console = Console()


@app.command("query")
def search_query(
    query: str = typer.Argument(..., help="Search query"),
    database_url: str = typer.Option(
        "sqlite:///data/aiwebfeeds.db",
        "--database-url",
        "-d",
        help="Database URL",
    ),
    search_type: str = typer.Option(
        "full_text",
        "--type",
        "-t",
        help="Search type: full_text or semantic",
    ),
    limit: int = typer.Option(
        20,
        "--limit",
        "-l",
        help="Maximum results",
    ),
    source_type: Optional[str] = typer.Option(
        None,
        "--source-type",
        help="Filter by source type",
    ),
    topics: Optional[str] = typer.Option(
        None,
        "--topics",
        help="Filter by topics (comma-separated)",
    ),
    verified: Optional[bool] = typer.Option(
        None,
        "--verified/--unverified",
        help="Filter by verified status",
    ),
):
    """Search for feeds with full-text or semantic search."""
    console.print(f"[bold cyan]Search Query:[/bold cyan] {query}\n")

    db = DatabaseManager(database_url)

    # Build filters
    filters = {}
    if source_type:
        filters["source_type"] = source_type
    if topics:
        filters["topics"] = [t.strip() for t in topics.split(",")]
    if verified is not None:
        filters["verified"] = verified

    # Search
    with console.status(f"[bold green]Searching with {search_type}..."):
        results = db.search_feeds(query, search_type=search_type, limit=limit, filters=filters)

    # Display results
    if not results:
        console.print("[yellow]No results found[/yellow]")
        return

    if search_type == "semantic":
        # Semantic search returns (feed, score) tuples
        table = Table(title=f"Search Results ({len(results)})", show_header=True)
        table.add_column("Rank", style="dim", width=5)
        table.add_column("Title", style="cyan")
        table.add_column("Topics", style="green")
        table.add_column("Similarity", style="yellow", justify="right")
        table.add_column("URL", style="blue")

        for idx, (feed, similarity) in enumerate(results, 1):
            topics_str = ", ".join(feed.topics[:3]) if feed.topics else "-"
            if len(feed.topics) > 3:
                topics_str += f" +{len(feed.topics) - 3} more"

            table.add_row(
                str(idx),
                feed.title[:50] if len(feed.title) > 50 else feed.title,
                topics_str,
                f"{similarity:.3f}",
                (feed.feed or feed.site or "")[:40],
            )
    else:
        # Full-text search returns feeds
        table = Table(title=f"Search Results ({len(results)})", show_header=True)
        table.add_column("Rank", style="dim", width=5)
        table.add_column("Title", style="cyan")
        table.add_column("Topics", style="green")
        table.add_column("Verified", style="yellow", justify="center")
        table.add_column("URL", style="blue")

        for idx, feed in enumerate(results, 1):
            topics_str = ", ".join(feed.topics[:3]) if feed.topics else "-"
            if len(feed.topics) > 3:
                topics_str += f" +{len(feed.topics) - 3} more"

            verified_icon = "✓" if feed.verified else "✗"

            table.add_row(
                str(idx),
                feed.title[:50] if len(feed.title) > 50 else feed.title,
                topics_str,
                verified_icon,
                (feed.feed or feed.site or "")[:40],
            )

    console.print(table)
    console.print(f"\n[green]✓[/green] Found {len(results)} results")


@app.command("autocomplete")
def search_autocomplete(
    prefix: str = typer.Argument(..., help="Search prefix"),
    database_url: str = typer.Option(
        "sqlite:///data/aiwebfeeds.db",
        "--database-url",
        "-d",
        help="Database URL",
    ),
    limit: int = typer.Option(
        8,
        "--limit",
        "-l",
        help="Maximum suggestions",
    ),
):
    """Get autocomplete suggestions."""
    console.print(f"[bold cyan]Autocomplete:[/bold cyan] {prefix}\n")

    db = DatabaseManager(database_url)

    # Get suggestions
    suggestions = db.autocomplete_search(prefix, limit=limit)

    # Display feeds
    if suggestions["feeds"]:
        console.print("[bold]Feed Suggestions:[/bold]")
        for feed in suggestions["feeds"]:
            console.print(f"  • [cyan]{feed['title']}[/cyan] ({feed['id']})")

    # Display topics
    if suggestions["topics"]:
        console.print("\n[bold]Topic Suggestions:[/bold]")
        for topic in suggestions["topics"]:
            console.print(
                f"  • [green]{topic['label']}[/green] ({topic['feed_count']} feeds)"
            )

    if not suggestions["feeds"] and not suggestions["topics"]:
        console.print("[yellow]No suggestions found[/yellow]")


@app.command("init")
def search_init(
    database_url: str = typer.Option(
        "sqlite:///data/aiwebfeeds.db",
        "--database-url",
        "-d",
        help="Database URL",
    ),
):
    """Initialize search tables (FTS5 + Trie index)."""
    console.print("[bold cyan]Initializing Search Tables[/bold cyan]\n")

    db = DatabaseManager(database_url)

    with console.status("[bold green]Creating FTS5 table and Trie index..."):
        db.initialize_search_tables()

    console.print("[green]✓[/green] Search tables initialized")
    console.print("  • FTS5 virtual table created")
    console.print("  • Triggers configured")
    console.print("  • Trie index built")


@app.command("embeddings")
def search_embeddings(
    database_url: str = typer.Option(
        "sqlite:///data/aiwebfeeds.db",
        "--database-url",
        "-d",
        help="Database URL",
    ),
    provider: Optional[str] = typer.Option(
        None,
        "--provider",
        "-p",
        help="Embedding provider: local or huggingface",
    ),
):
    """Generate embeddings for all feeds."""
    console.print("[bold cyan]Generating Feed Embeddings[/bold cyan]\n")

    if provider:
        # Temporarily override config
        from ai_web_feeds.config import settings
        settings.embedding.provider = provider
        console.print(f"Using provider: [bold]{provider}[/bold]")

    db = DatabaseManager(database_url)

    with console.status("[bold green]Generating embeddings..."):
        with db.get_session() as session:
            from ai_web_feeds.embeddings import refresh_all_embeddings
            refresh_all_embeddings(session, show_progress=True)

    console.print("\n[green]✓[/green] Embeddings generated successfully")


@app.command("save")
def save_search_cmd(
    name: str = typer.Argument(..., help="Search name"),
    query: str = typer.Argument(..., help="Search query"),
    database_url: str = typer.Option(
        "sqlite:///data/aiwebfeeds.db",
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
    topics: Optional[str] = typer.Option(
        None,
        "--topics",
        help="Filter topics (comma-separated)",
    ),
):
    """Save a search for one-click replay."""
    console.print(f"[bold cyan]Saving Search:[/bold cyan] {name}\n")

    db = DatabaseManager(database_url)

    # Build filters
    filters = {}
    if topics:
        filters["topics"] = [t.strip() for t in topics.split(",")]

    # Save search
    saved_search = db.save_user_search(user_id, name, query, filters)

    console.print(f"[green]✓[/green] Search saved: {name}")
    console.print(f"  ID: {saved_search.id}")
    console.print(f"  Query: {query}")
    if filters:
        console.print(f"  Filters: {filters}")


@app.command("list-saved")
def list_saved_searches(
    database_url: str = typer.Option(
        "sqlite:///data/aiwebfeeds.db",
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
):
    """List all saved searches for a user."""
    console.print(f"[bold cyan]Saved Searches for:[/bold cyan] {user_id}\n")

    db = DatabaseManager(database_url)

    # Get saved searches
    saved_searches = db.get_user_saved_searches(user_id)

    if not saved_searches:
        console.print("[yellow]No saved searches found[/yellow]")
        return

    table = Table(show_header=True)
    table.add_column("Name", style="cyan")
    table.add_column("Query", style="green")
    table.add_column("Filters", style="yellow")
    table.add_column("Last Used", style="blue")

    for search in saved_searches:
        filters_str = ", ".join(f"{k}={v}" for k, v in search.filters.items()) if search.filters else "-"
        table.add_row(
            search.search_name,
            search.query_text,
            filters_str[:30],
            search.last_used_at.strftime("%Y-%m-%d %H:%M"),
        )

    console.print(table)
    console.print(f"\n[green]✓[/green] Found {len(saved_searches)} saved searches")


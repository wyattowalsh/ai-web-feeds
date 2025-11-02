"""ai_web_feeds.cli.commands.load -- Load feeds from YAML into database"""

from pathlib import Path

import typer
from loguru import logger
from rich.console import Console
from tqdm import tqdm

from ai_web_feeds import DatabaseManager, load_feeds

app = typer.Typer(help="Load feeds from YAML into database")
console = Console()


@app.command()
def from_yaml(
    input_file: Path = typer.Option(
        Path("data/feeds.yaml"),
        "--input",
        "-i",
        help="Input YAML file",
    ),
    database_url: str = typer.Option(
        "sqlite:///data/aiwebfeeds.db",
        "--database",
        "-d",
        help="Database URL",
    ),
    clear_existing: bool = typer.Option(
        False,
        "--clear/--keep-existing",
        help="Clear existing feeds before loading",
    ),
) -> None:
    """Load feeds from YAML file into database."""
    try:
        console.print("[bold]Loading feeds into database[/bold]\n")
        
        # Initialize database
        db = DatabaseManager(database_url)
        db.create_db_and_tables()
        
        # Load YAML data
        console.print(f"[dim]Reading {input_file}...[/dim]")
        feeds_data = load_feeds(input_file)
        sources = feeds_data.get("sources", [])
        
        if not sources:
            console.print("[yellow]⚠[/yellow] No feeds found in file")
            return
        
        console.print(f"[green]✓[/green] Found {len(sources)} feed sources\n")
        
        # Clear existing if requested
        if clear_existing:
            console.print("[dim]Clearing existing feeds...[/dim]")
            with db.get_session() as session:
                from ai_web_feeds.models import FeedSource
                from sqlmodel import delete
                
                stmt = delete(FeedSource)
                session.exec(stmt)
                session.commit()
            console.print("[green]✓[/green] Cleared existing feeds\n")
        
        # Insert feeds with progress bar
        console.print("[bold]Inserting feeds...[/bold]")
        success_count = 0
        error_count   = 0
        
        with tqdm(total=len(sources), desc="Loading", unit="feed") as pbar:
            for source_data in sources:
                try:
                    # Convert source_data to FeedSource model and add to DB
                    from ai_web_feeds.models import FeedSource, SourceType
                    
                    # Map source_type string to enum
                    source_type_str = source_data.get("source_type", "other")
                    source_type     = SourceType(source_type_str) if source_type_str else None
                    
                    feed_source = FeedSource(
                        url         = source_data["url"],
                        title       = source_data.get("title", ""),
                        source_type = source_type,
                        description = source_data.get("description"),
                        website_url = source_data.get("website_url"),
                        verified    = source_data.get("verified", False),
                        is_active   = source_data.get("is_active", True),
                        topics      = source_data.get("topics", []),
                        tags        = source_data.get("tags", []),
                    )
                    
                    db.add_feed_source(feed_source)
                    success_count += 1
                    
                except Exception as e:
                    error_count += 1
                    logger.warning(f"Failed to load feed {source_data.get('url', 'unknown')}: {e}")
                
                pbar.update(1)
        
        console.print()
        console.print(f"[green]✓[/green] Successfully loaded {success_count} feeds")
        
        if error_count > 0:
            console.print(f"[yellow]⚠[/yellow] {error_count} feeds failed to load (check logs)")
        
        # Show summary stats
        console.print(f"\n[bold]Database:[/bold] {database_url}")
        console.print(f"[bold]Total feeds:[/bold] {success_count}")
        
    except FileNotFoundError as e:
        console.print(f"[red]✗[/red] File not found: {e}")
        raise typer.Exit(code=1)
    except Exception as e:
        console.print(f"[red]✗[/red] Load failed: {e}")
        logger.exception("Feed load failed")
        raise typer.Exit(code=1)


@app.command("all")
def load_all(
    input_file: Path = typer.Option(
        Path("data/feeds.yaml"),
        "--input",
        "-i",
        help="Input YAML file",
    ),
    database_url: str = typer.Option(
        "sqlite:///data/aiwebfeeds.db",
        "--database",
        "-d",
        help="Database URL",
    ),
) -> None:
    """Load all feeds (alias for from-yaml)."""
    from_yaml(input_file=input_file, database_url=database_url, clear_existing=False)


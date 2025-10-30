"""ai_web_feeds.cli -- Simplified CLI for AI Web Feeds

Main workflow: load → validate → enrich → validate → export + store + log
"""

from pathlib import Path

import typer
from loguru import logger
from rich.console import Console

from ai_web_feeds import (
    DatabaseManager,
    ValidationResult,
    enrich_all_feeds,
    export_all_formats,
    load_feeds,
    save_feeds,
    validate_feeds,
)

# Import command modules
from ai_web_feeds.cli.commands import analytics, monitor, nlp, recommend, search

app = typer.Typer(
    name="ai-web-feeds",
    help="AI Web Feeds - Process feed sources through: load → validate → enrich → export",
    add_completion=False,
)

# Register command modules
app.add_typer(analytics.app, name="analytics")
app.add_typer(search.app, name="search")
app.add_typer(recommend.app, name="recommend")
app.add_typer(monitor.app, name="monitor")
app.add_typer(nlp.app, name="nlp")

console = Console()


@app.command()
def process(
    input_file: Path = typer.Option(
        Path("data/feeds.yaml"),
        "--input",
        "-i",
        help="Input feeds YAML file",
    ),
    output_file: Path = typer.Option(
        Path("data/feeds.enriched.yaml"),
        "--output",
        "-o",
        help="Output enriched YAML file",
    ),
    schema_file: Path = typer.Option(
        None,
        "--schema",
        "-s",
        help="JSON schema file for validation",
    ),
    database_url: str = typer.Option(
        "sqlite:///data/aiwebfeeds.db",
        "--database",
        "-d",
        help="Database URL for storage",
    ),
    export_formats: bool = typer.Option(
        True,
        "--export/--no-export",
        help="Export to additional formats (JSON, OPML)",
    ),
    skip_validation: bool = typer.Option(
        False,
        "--skip-validation",
        help="Skip validation steps",
    ),
    skip_enrichment: bool = typer.Option(
        False,
        "--skip-enrichment",
        help="Skip enrichment step",
    ),
) -> None:
    """Process feeds through the complete pipeline: load → validate → enrich → export + store."""
    console.print("\n[bold blue]AI Web Feeds Processing Pipeline[/bold blue]\n")

    # Step 1: Load
    console.print("[bold]Step 1:[/bold] Loading feeds...")
    try:
        feeds_data = load_feeds(input_file)
        console.print(f"[green]✓[/green] Loaded {len(feeds_data.get('sources', []))} sources\n")
    except Exception as e:
        console.print(f"[red]✗ Failed to load feeds: {e}[/red]")
        raise typer.Exit(1)

    # Step 2: Validate (initial)
    if not skip_validation:
        console.print("[bold]Step 2:[/bold] Validating feeds...")
        result = validate_feeds(feeds_data, schema_file)
        if not result.valid:
            console.print("[red]✗ Validation failed:[/red]")
            for error in result.errors:
                console.print(f"  - {error}")
            raise typer.Exit(1)
        console.print("[green]✓ Validation passed[/green]\n")

    # Step 3: Enrich
    if not skip_enrichment:
        console.print("[bold]Step 3:[/bold] Enriching feeds...")
        try:
            # Initialize database for enrichment persistence
            db = DatabaseManager(database_url)
            db.create_db_and_tables()
            
            feeds_data = enrich_all_feeds(feeds_data, db=db)
            console.print("[green]✓ Enrichment complete[/green]\n")
        except Exception as e:
            console.print(f"[red]✗ Enrichment failed: {e}[/red]")
            logger.exception("Enrichment error")
            raise typer.Exit(1)

    # Step 4: Validate (post-enrichment)
    if not skip_validation:
        console.print("[bold]Step 4:[/bold] Validating enriched feeds...")
        result = validate_feeds(feeds_data, schema_file)
        if not result.valid:
            console.print("[yellow]⚠ Post-enrichment validation warnings:[/yellow]")
            for error in result.errors:
                console.print(f"  - {error}")
        else:
            console.print("[green]✓ Post-enrichment validation passed[/green]\n")

    # Step 5: Export
    console.print("[bold]Step 5:[/bold] Exporting...")

    # Save enriched YAML
    save_feeds(feeds_data, output_file)
    console.print(f"[green]✓ Saved to {output_file}[/green]")

    # Export to additional formats
    if export_formats:
        output_dir = output_file.parent
        prefix = output_file.stem
        export_all_formats(feeds_data, output_dir, prefix)
        console.print("[green]✓ Exported to JSON and OPML formats[/green]")

    # Step 6: Store in database
    console.print("\n[bold]Step 6:[/bold] Storing in database...")
    try:
        db = DatabaseManager(database_url)
        db.create_db_and_tables()

        # Store feed sources
        from ai_web_feeds.models import FeedSource

        sources = feeds_data.get("sources", [])
        stored_count = 0

        errors = []
        for source_data in sources:
            try:
                # Use URL as fallback ID if no explicit ID provided
                source_id = source_data.get("id", source_data.get("url", ""))
                
                feed_source = FeedSource(
                    id=source_id,
                    feed=source_data.get("feed"),
                    site=source_data.get("site"),
                    title=source_data.get("title", source_data.get("url", "")),
                    source_type=source_data.get("source_type"),
                    mediums=source_data.get("mediums", []),
                    topics=source_data.get("topics", []),
                    language=source_data.get("language"),
                    description=source_data.get("description"),
                    curation_status=source_data.get("curation_status"),
                    notes=source_data.get("notes"),
                    tags=source_data.get("tags", []),
                    topic_weights=source_data.get("topic_weights", {}),
                )
                db.add_feed_source(feed_source)
                stored_count += 1
            except Exception as e:
                error_msg = f"{source_data.get('url', 'unknown')}: {e}"
                errors.append(error_msg)
                logger.warning(f"Failed to store source: {error_msg}")

        console.print(f"[green]✓ Stored {stored_count}/{len(sources)} sources in database[/green]")
        
        if errors and len(errors) <= 5:
            console.print("[yellow]⚠ Storage warnings:[/yellow]")
            for error in errors[:5]:
                console.print(f"  • {error}")

    except Exception as e:
        console.print(f"[red]✗ Database storage failed: {e}[/red]")
        logger.exception("Database error")
        raise typer.Exit(1)

    # Summary
    console.print("\n[bold green]✓ Processing complete![/bold green]")
    console.print(f"\n[bold]Outputs:[/bold]")
    console.print(f"  • Enriched YAML: {output_file}")
    if export_formats:
        console.print(f"  • JSON: {output_file.parent}/feeds.json")
        console.print(f"  • OPML (flat): {output_file.parent}/feeds.opml")
        console.print(f"  • OPML (categorized): {output_file.parent}/feeds.categorized.opml")
    console.print(f"  • Database: {database_url}")
    console.print(f"\n[bold]Statistics:[/bold]")
    console.print(f"  • Sources processed: {len(sources)}")
    console.print(f"  • Sources stored: {stored_count}")
    if errors:
        console.print(f"  • Storage errors: {len(errors)}")


@app.command()
def load(
    input_file: Path = typer.Argument(..., help="Input feeds YAML file"),
) -> None:
    """Load and display feeds from YAML file."""
    try:
        feeds_data = load_feeds(input_file)
        sources = feeds_data.get("sources", [])
        console.print(f"[green]✓ Loaded {len(sources)} feed sources from {input_file}[/green]")
    except Exception as e:
        console.print(f"[red]✗ Failed to load: {e}[/red]")
        raise typer.Exit(1)


@app.command()
def validate(
    input_file: Path = typer.Argument(..., help="Input feeds YAML file"),
    schema_file: Path = typer.Option(None, "--schema", "-s", help="JSON schema file"),
) -> None:
    """Validate feeds against schema."""
    try:
        feeds_data = load_feeds(input_file)
        result = validate_feeds(feeds_data, schema_file)

        if result.valid:
            console.print("[green]✓ Validation passed![/green]")
        else:
            console.print("[red]✗ Validation failed:[/red]")
            for error in result.errors:
                console.print(f"  - {error}")
            raise typer.Exit(1)

    except Exception as e:
        console.print(f"[red]✗ Error: {e}[/red]")
        raise typer.Exit(1)


@app.command()
def enrich(
    input_file: Path = typer.Argument(..., help="Input feeds YAML file"),
    output_file: Path = typer.Option(
        None,
        "--output",
        "-o",
        help="Output enriched YAML file (default: <input>.enriched.yaml)",
    ),
) -> None:
    """Enrich feeds with metadata."""
    try:
        feeds_data = load_feeds(input_file)
        enriched_data = enrich_all_feeds(feeds_data)

        if output_file is None:
            output_file = input_file.parent / f"{input_file.stem}.enriched.yaml"

        save_feeds(enriched_data, output_file)
        console.print(f"[green]✓ Enriched feeds saved to {output_file}[/green]")

    except Exception as e:
        console.print(f"[red]✗ Error: {e}[/red]")
        logger.exception("Enrichment error")
        raise typer.Exit(1)


@app.command()
def export(
    input_file: Path = typer.Argument(..., help="Input feeds YAML file"),
    output_dir: Path = typer.Option(
        None,
        "--output-dir",
        "-o",
        help="Output directory (default: same as input)",
    ),
    prefix: str = typer.Option(
        None,
        "--prefix",
        "-p",
        help="Output filename prefix (default: input filename)",
    ),
) -> None:
    """Export feeds to various formats (JSON, OPML)."""
    try:
        feeds_data = load_feeds(input_file)

        if output_dir is None:
            output_dir = input_file.parent

        if prefix is None:
            prefix = input_file.stem

        export_all_formats(feeds_data, output_dir, prefix)
        console.print(f"[green]✓ Exported to {output_dir}/{prefix}.*[/green]")

    except Exception as e:
        console.print(f"[red]✗ Error: {e}[/red]")
        raise typer.Exit(1)


@app.callback()
def callback():
    """AI Web Feeds CLI - Manage AI/ML feed sources."""


def main():
    """Entry point for the CLI."""
    app()


if __name__ == "__main__":
    main()

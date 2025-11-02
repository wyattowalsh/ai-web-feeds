"""ai_web_feeds.cli.commands.validate -- Validate feed data"""

import asyncio
import json
import sys
from pathlib import Path
from typing import Optional

import typer
import yaml
from rich.console import Console
from rich.table import Table

from ai_web_feeds import DatabaseManager
from ai_web_feeds.validate import validate_all_feeds, calculate_health_score

app = typer.Typer(help="Validate feed data against schemas")
console = Console()


def get_data_dir() -> Path:
    """Get the data directory path."""
    # Navigate from CLI location to workspace root
    current = Path(__file__).resolve()
    for parent in current.parents:
        data_dir = parent / "data"
        if data_dir.exists():
            return data_dir
    raise RuntimeError("Could not find data directory")


@app.command("feeds")
def validate_feeds(
    feeds_file: Optional[Path] = typer.Option(None, "--file", "-f", help="Path to feeds.yaml file"),
    schema_file: Optional[Path] = typer.Option(None, "--schema", "-s", help="Path to schema file"),
    strict: bool = typer.Option(True, "--strict/--lenient", help="Strict validation mode"),
):
    """Validate feeds.yaml against schema."""
    try:
        import jsonschema
    except ImportError:
        console.print("[red]Error: jsonschema not installed. Run: uv pip install jsonschema[/red]")
        sys.exit(1)

    data_dir = get_data_dir()
    feeds_path = feeds_file or data_dir / "feeds.yaml"
    schema_path = schema_file or data_dir / "feeds.schema.json"

    if not feeds_path.exists():
        console.print(f"[red]Error: {feeds_path} not found[/red]")
        sys.exit(1)

    if not schema_path.exists():
        console.print(f"[red]Error: {schema_path} not found[/red]")
        sys.exit(1)

    console.print(f"📋 Validating {feeds_path.name} against {schema_path.name}")

    # Load files
    with open(feeds_path) as f:
        feeds_data = yaml.safe_load(f)

    with open(schema_path) as f:
        schema_data = json.load(f)

    # Validate schema
    try:
        jsonschema.validate(instance=feeds_data, schema=schema_data)
        console.print("[green]✅ Schema validation passed![/green]")
    except jsonschema.ValidationError as e:
        console.print("[red]❌ Schema validation failed![/red]")
        console.print(f"[red]Error: {e.message}[/red]")
        console.print(f"[yellow]Path: {' -> '.join(str(p) for p in e.path)}[/yellow]")
        sys.exit(1)

    # Additional validations
    sources = feeds_data.get("sources", [])
    console.print(f"\n📊 Found {len(sources)} feed sources")

    # Check for duplicate IDs
    ids = [s.get("id") for s in sources if s.get("id")]
    duplicates = [id for id in set(ids) if ids.count(id) > 1]

    if duplicates:
        console.print(f"[red]❌ Duplicate IDs found: {', '.join(duplicates)}[/red]")
        if strict:
            sys.exit(1)
    else:
        console.print("[green]✅ No duplicate IDs[/green]")

    console.print("\n[green]✅ All validations passed![/green]")


@app.command("topics")
def validate_topics(
    topics_file: Optional[Path] = typer.Option(
        None, "--file", "-f", help="Path to topics.yaml file"
    ),
    schema_file: Optional[Path] = typer.Option(None, "--schema", "-s", help="Path to schema file"),
):
    """Validate topics.yaml against schema."""
    try:
        import jsonschema
    except ImportError:
        console.print("[red]Error: jsonschema not installed. Run: uv pip install jsonschema[/red]")
        sys.exit(1)

    data_dir = get_data_dir()
    topics_path = topics_file or data_dir / "topics.yaml"
    schema_path = schema_file or data_dir / "topics.schema.json"

    if not topics_path.exists():
        console.print(f"[red]Error: {topics_path} not found[/red]")
        sys.exit(1)

    if not schema_path.exists():
        console.print(f"[red]Error: {schema_path} not found[/red]")
        sys.exit(1)

    console.print(f"📋 Validating {topics_path.name} against {schema_path.name}")

    # Load files
    with open(topics_path) as f:
        topics_data = yaml.safe_load(f)

    with open(schema_path) as f:
        schema_data = json.load(f)

    # Validate schema
    try:
        jsonschema.validate(instance=topics_data, schema=schema_data)
        console.print("[green]✅ Schema validation passed![/green]")
    except jsonschema.ValidationError as e:
        console.print("[red]❌ Schema validation failed![/red]")
        console.print(f"[red]Error: {e.message}[/red]")
        sys.exit(1)

    console.print("[green]✅ All validations passed![/green]")


@app.command("references")
def validate_topic_references():
    """Validate that all topic references in feeds exist in topics.yaml."""
    data_dir = get_data_dir()
    feeds_path = data_dir / "feeds.yaml"
    topics_path = data_dir / "topics.yaml"

    if not feeds_path.exists() or not topics_path.exists():
        console.print("[red]Error: Required files not found[/red]")
        sys.exit(1)

    console.print("🔗 Validating topic references...")

    # Load data
    with open(topics_path) as f:
        topics_data = yaml.safe_load(f)

    with open(feeds_path) as f:
        feeds_data = yaml.safe_load(f)

    # Get all valid topic IDs
    valid_topics = set()
    for category in topics_data.get("categories", []):
        for topic in category.get("topics", []):
            valid_topics.add(topic["id"])

    console.print(f"📚 Found {len(valid_topics)} valid topics")

    # Check each feed's topics
    errors = []
    for source in feeds_data.get("sources", []):
        feed_id = source.get("id", "unknown")
        feed_topics = source.get("topics", [])

        for topic in feed_topics:
            if topic not in valid_topics:
                errors.append((feed_id, topic))

    if errors:
        console.print(f"\n[red]❌ Found {len(errors)} invalid topic references:[/red]")
        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("Feed ID")
        table.add_column("Invalid Topic")

        for feed_id, topic in errors:
            table.add_row(feed_id, topic)

        console.print(table)
        sys.exit(1)
    else:
        console.print("[green]✅ All topic references are valid![/green]")


@app.command("all")
def validate_all(
    strict: bool = typer.Option(True, "--strict/--lenient", help="Strict validation mode"),
):
    """Run all validation checks."""
    console.print("🔍 Running all validations...\n")

    exit_code = 0

    # Validate feeds schema
    try:
        console.print("1. Validating feeds.yaml schema...")
        validate_feeds(strict=strict)
    except SystemExit as e:
        exit_code = e.code or 1

    # Validate topics schema
    try:
        console.print("\n2. Validating topics.yaml schema...")
        validate_topics()
    except SystemExit as e:
        exit_code = e.code or 1

    # Validate references
    try:
        console.print("\n3. Validating topic references...")
        validate_topic_references()
    except SystemExit as e:
        exit_code = e.code or 1

    if exit_code == 0:
        console.print("\n[green]✅ All validations passed![/green]")
    else:
        console.print("\n[red]❌ Some validations failed![/red]")

    sys.exit(exit_code)


@app.command("http")
def validate_http_feeds(
    database_url: str = typer.Option(
        "sqlite:///data/aiwebfeeds.db",
        "--database",
        "-d",
        help="Database URL",
    ),
    concurrency: int = typer.Option(
        10,
        "--concurrency",
        "-c",
        help="Maximum concurrent HTTP requests",
    ),
    feed_id: Optional[str] = typer.Option(
        None,
        "--feed-id",
        "-f",
        help="Validate specific feed by ID (otherwise validates all)",
    ),
):
    """Validate feed URLs with HTTP accessibility checks."""
    console.print("[bold]HTTP Feed Validation[/bold]\n")

    # Initialize database
    db = DatabaseManager(database_url)

    # Get feeds to validate
    if feed_id:
        console.print(f"[dim]Validating single feed: {feed_id}[/dim]")
        feed_source = db.get_feed_source(feed_id)
        if not feed_source:
            console.print(f"[red]✗[/red] Feed not found: {feed_id}")
            sys.exit(1)
        feed_sources = [feed_source]
    else:
        console.print("[dim]Loading all feed sources...[/dim]")
        feed_sources = db.get_all_feed_sources()
        if not feed_sources:
            console.print("[yellow]⚠[/yellow] No feed sources found in database")
            sys.exit(0)
        console.print(f"[green]✓[/green] Found {len(feed_sources)} feeds\n")

    # Run async validation
    async def run_validation():
        return await validate_all_feeds(
            feed_sources,
            concurrency_limit=concurrency,
            show_progress=True,
        )

    console.print(f"[bold]Validating feeds (max {concurrency} concurrent)...[/bold]")
    validation_results = asyncio.run(run_validation())

    # Store results in database
    console.print("\n[dim]Storing validation results...[/dim]")
    for result in validation_results:
        db.add_validation_result(result)

    # Generate report
    console.print("\n[bold]Validation Report[/bold]")
    console.print("═" * 60)

    success_count = sum(1 for r in validation_results if r.success)
    failure_count = len(validation_results) - success_count
    success_rate = (success_count / len(validation_results)) * 100 if validation_results else 0

    console.print(f"Total Feeds:     {len(validation_results)}")
    console.print(f"[green]Successful:      {success_count} ({success_rate:.1f}%)[/green]")
    console.print(f"[red]Failed:          {failure_count} ({100-success_rate:.1f}%)[/red]")

    # Average response time
    response_times = [r.response_time_ms for r in validation_results if r.response_time_ms]
    if response_times:
        avg_response = sum(response_times) / len(response_times)
        console.print(f"Avg Response:    {avg_response:.0f}ms")

    # Error summary
    if failure_count > 0:
        console.print("\n[bold]Top Errors:[/bold]")
        error_counts = {}
        for result in validation_results:
            if not result.success and result.error_message:
                error = result.error_message.split(":")[0]  # Get error type
                error_counts[error] = error_counts.get(error, 0) + 1

        for error, count in sorted(error_counts.items(), key=lambda x: -x[1])[:5]:
            console.print(f"  • {error}: {count} feeds")

    console.print("═" * 60)

    # Exit with error if validation failed
    if failure_count > 0 and not feed_id:
        sys.exit(1)


@app.command("report")
def validation_report(
    database_url: str = typer.Option(
        "sqlite:///data/aiwebfeeds.db",
        "--database",
        "-d",
        help="Database URL",
    ),
    recent: int = typer.Option(
        10,
        "--recent",
        "-n",
        help="Number of recent validations to analyze per feed",
    ),
):
    """Generate comprehensive validation health report."""
    console.print("[bold]Validation Health Report[/bold]\n")

    # Initialize database
    db = DatabaseManager(database_url)

    # Get all feeds with validation history
    feed_sources = db.get_all_feed_sources()

    if not feed_sources:
        console.print("[yellow]⚠[/yellow] No feed sources found")
        sys.exit(0)

    console.print(f"[dim]Analyzing {len(feed_sources)} feeds...[/dim]\n")

    # Build health report
    health_data = []
    for feed in feed_sources:
        history = db.get_validation_history(feed.id, limit=recent)
        if history:
            health_score = calculate_health_score(history, max_results=recent)
            success_count = sum(1 for r in history if r.success)
            success_rate = (success_count / len(history)) * 100

            health_data.append(
                {
                    "id": feed.id,
                    "title": feed.title[:40],
                    "health": health_score,
                    "success_rate": success_rate,
                    "validations": len(history),
                    "verified": feed.verified,
                }
            )

    if not health_data:
        console.print("[yellow]⚠[/yellow] No validation history found")
        sys.exit(0)

    # Sort by health score
    health_data.sort(key=lambda x: x["health"], reverse=True)

    # Display table
    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("Feed ID", style="cyan", width=20)
    table.add_column("Title", style="white", width=40)
    table.add_column("Health", justify="right")
    table.add_column("Success Rate", justify="right")
    table.add_column("Checks", justify="right")
    table.add_column("Verified", justify="center")

    for data in health_data[:20]:  # Top 20
        health_color = (
            "green" if data["health"] >= 0.8 else "yellow" if data["health"] >= 0.5 else "red"
        )
        health_str = f"[{health_color}]{data['health']:.2f}[/{health_color}]"
        success_str = f"{data['success_rate']:.0f}%"
        verified_str = "✓" if data["verified"] else "✗"

        table.add_row(
            data["id"],
            data["title"],
            health_str,
            success_str,
            str(data["validations"]),
            verified_str,
        )

    console.print(table)

    # Summary stats
    avg_health = sum(d["health"] for d in health_data) / len(health_data)
    healthy_feeds = sum(1 for d in health_data if d["health"] >= 0.8)

    console.print("\n[bold]Summary:[/bold]")
    console.print(f"Average Health Score: {avg_health:.2f}")
    console.print(
        f"Healthy Feeds (≥0.8): {healthy_feeds} ({healthy_feeds/len(health_data)*100:.1f}%)"
    )
    console.print(f"Total Feeds Analyzed: {len(health_data)}")

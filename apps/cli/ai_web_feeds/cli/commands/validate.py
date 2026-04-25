"""Validate feed documents, topic data, and feed URLs."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any, Optional, cast

import typer
import yaml  # type: ignore[import-untyped]
from ai_web_feeds.config import DEFAULT_DATABASE_URL
from ai_web_feeds.validate import calculate_health_score, validate_all_feeds
from rich.console import Console
from rich.table import Table

from ai_web_feeds import DatabaseManager

app = typer.Typer(
    help="Validate feed documents, topic data, and feed URLs",
    invoke_without_command=True,
    no_args_is_help=True,
    context_settings={"allow_extra_args": True},
)
cli = app


def get_data_dir() -> Path:
    """Return the repository data directory."""
    return default_data_dir()


@app.command("feeds")
def validate_feeds(
    feeds_file: Optional[Path] = typer.Option(None, "--file", "-f", help="Path to feeds.yaml file"),
    schema_file: Optional[Path] = typer.Option(None, "--schema", "-s", help="Path to schema file"),
    strict: bool = typer.Option(True, "--strict/--lenient", help="Strict validation mode"),
) -> None:
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
    with feeds_path.open() as f:
        feeds_data = yaml.safe_load(f)

    with schema_path.open() as f:
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
) -> None:
    """Validate topics.yaml against schema."""
    try:
        import jsonschema
    except ImportError:
        console.print("[red]Error: jsonschema not installed. Run: uv pip install jsonschema[/red]")
        sys.exit(1)

    data_dir = get_data_dir()
    resolved_input = input_path or data_dir / "topics.yaml"
    default_schema = data_dir / "topics.schema.json"
    resolved_schema = schema_path or (default_schema if default_schema.exists() else None)
    return resolved_input, resolved_schema


def _run_feed_document_validation(
    *,
    input_path: Path | None,
    schema_path: Path | None,
    strict: bool,
) -> tuple[CommandResult, bool]:
    resolved_input, resolved_schema = _resolve_feeds_input(input_path, schema_path)
    if not resolved_input.exists():
        return (
            CommandResult(
                status="error",
                summary="Feed document not found",
                details={"input": str(resolved_input)},
            ),
            False,
        )
    if resolved_schema is not None and not resolved_schema.exists():
        return (
            CommandResult(
                status="error",
                summary="Feed schema not found",
                details={"schema": str(resolved_schema)},
            ),
            False,
        )

    console.print(f"📋 Validating {topics_path.name} against {schema_path.name}")

    # Load files
    with topics_path.open() as f:
        topics_data = yaml.safe_load(f)

    with schema_path.open() as f:
        schema_data = json.load(f)

    # Validate schema
    try:
        feeds_data = normalize_feed_document(load_feeds(resolved_input))
        validation = core_validate_feeds(feeds_data, resolved_schema)
    except Exception as exc:
        return (
            CommandResult(
                status="error",
                summary="Feed validation failed unexpectedly",
                details={"input": str(resolved_input), "error": str(exc)},
            ),
            False,
        )

    is_ok = validation.valid or not strict
    return (
        CommandResult(
            status="success" if validation.valid else ("warning" if is_ok else "error"),
            summary="Feed document validation passed"
            if validation.valid
            else "Feed document validation reported issues",
            details={
                "input": str(resolved_input),
                "schema": str(resolved_schema) if resolved_schema else None,
                "source_count": len(get_sources(feeds_data)),
                "strict": strict,
                "errors": validation.errors,
            },
        ),
        is_ok,
    )


@app.command("references")
def validate_topic_references() -> None:
    """Validate that all topic references in feeds exist in topics.yaml."""
    data_dir = get_data_dir()
    feeds_path = data_dir / "feeds.yaml"
    topics_path = data_dir / "topics.yaml"
    if not feeds_path.exists() or not topics_path.exists():
        return (
            CommandResult(
                status="error",
                summary="Required data files were not found",
                details={"feeds": str(feeds_path), "topics": str(topics_path)},
            ),
            False,
        )

    with topics_path.open(encoding="utf-8") as handle:
        topics_data = yaml.safe_load(handle) or {}
    with feeds_path.open(encoding="utf-8") as handle:
        feeds_data = normalize_feed_document(yaml.safe_load(handle) or {})

    # Load data
    with topics_path.open() as f:
        topics_data = yaml.safe_load(f)

    with feeds_path.open() as f:
        feeds_data = yaml.safe_load(f)

    # Get all valid topic IDs
    valid_topics = set()
    for category in topics_data.get("categories", []):
        for topic in category.get("topics", []):
            topic_id = topic.get("id")
            if topic_id:
                valid_topics.add(topic_id)

    errors = []
    for source in get_sources(feeds_data):
        source_id = source.get("id", "unknown")
        for topic in source.get("topics", []):
            if topic not in valid_topics:
                errors.append({"feed_id": source_id, "topic": topic})

    is_ok = not errors or not strict
    return (
        CommandResult(
            status="success" if not errors else ("warning" if is_ok else "error"),
            summary="Topic references are valid"
            if not errors
            else "Invalid topic references found",
            details={
                "feeds": str(feeds_path),
                "topics": str(topics_path),
                "invalid_references": errors,
                "strict": strict,
            },
        ),
        is_ok,
    )


def _run_url_validation(feed_url: str, *, timeout: float) -> tuple[CommandResult, bool]:
    try:
        result = asyncio.run(validate_feed_url(feed_url, timeout=timeout))
    except Exception as exc:
        return (
            CommandResult(
                status="error",
                summary="Feed URL validation failed",
                details={"url": feed_url, "error": str(exc), "timeout": timeout},
            ),
            False,
        )

    is_ok = bool(result.get("success"))
    return (
        CommandResult(
            status="success" if is_ok else "error",
            summary="Feed URL validation passed" if is_ok else "Feed URL validation failed",
            details={
                "url": feed_url,
                "timeout": timeout,
                "status_code": result.get("status_code"),
                "response_time_ms": result.get("response_time_ms"),
                "feed_format": result.get("feed_format"),
                "entry_count": result.get("entry_count"),
                "error_message": result.get("error_message"),
            },
        ),
        is_ok,
    )


@app.callback(invoke_without_command=True)
def callback(
    ctx: typer.Context,
    schema_path: Path | None = typer.Option(
        None,
        "--schema",
        "-s",
        help="Path to a JSON schema file",
    ),
    run_all: bool = typer.Option(
        False,
        "--all",
        help="Run all validation checks",
    ),
    strict: bool = typer.Option(
        True,
        "--strict/--lenient",
        help="Fail on validation problems",
    ),
    format: ResultFormat = typer.Option(
        ResultFormat.TEXT,
        "--format",
        "-f",
        help="Summary output format",
        case_sensitive=False,
    ),
) -> None:
    """Support compatibility forms such as ``validate <file>`` and ``validate --all``."""
    if ctx.invoked_subcommand is not None:
        return
    if run_all:
        if ctx.args:
            raise typer.BadParameter(
                "The validation suite does not accept an input file when --all is set."
            )
        validate_all_command(strict=strict, format=format)
        return
    if not ctx.args:
        return
    if len(ctx.args) > 1:
        raise typer.BadParameter(
            "Expected a single input feeds YAML file when using the validate compatibility alias."
        )

    validate_feeds_command(
        input_path=Path(ctx.args[0]),
        schema_path=schema_path,
        strict=strict,
        format=format,
    )


@app.command("feeds")
def validate_feeds_command(
    input_path: Path | None = typer.Option(
        None,
        "--input",
        "-i",
        help="Path to feeds.yaml",
    ),
    schema_path: Path | None = typer.Option(
        None,
        "--schema",
        "-s",
        help="Path to the feed schema file",
    ),
    strict: bool = typer.Option(
        True,
        "--strict/--lenient",
        help="Fail on validation problems",
    ),
    format: ResultFormat = typer.Option(
        ResultFormat.TEXT,
        "--format",
        "-f",
        help="Summary output format",
        case_sensitive=False,
    ),
) -> None:
    """Validate a feed document against the feed schema."""
    result, ok = _run_feed_document_validation(
        input_path=input_path,
        schema_path=schema_path,
        strict=strict,
    )
    render_result(result, format=format)
    if not ok:
        raise typer.Exit(code=int(ExitCode.VALIDATION_ERROR))


@app.command("topics")
def validate_topics_command(
    input_path: Path | None = typer.Option(
        None,
        "--input",
        "-i",
        help="Path to topics.yaml",
    ),
    schema_path: Path | None = typer.Option(
        None,
        "--schema",
        "-s",
        help="Path to the topic schema file",
    ),
    strict: bool = typer.Option(
        True,
        "--strict/--lenient",
        help="Fail on validation problems",
    ),
    format: ResultFormat = typer.Option(
        ResultFormat.TEXT,
        "--format",
        "-f",
        help="Summary output format",
        case_sensitive=False,
    ),
) -> None:
    """Validate a topic document against the topic schema."""
    result, ok = _run_topic_document_validation(
        input_path=input_path,
        schema_path=schema_path,
        strict=strict,
    )
    render_result(result, format=format)
    if not ok:
        raise typer.Exit(code=int(ExitCode.VALIDATION_ERROR))


@app.command("references")
def validate_topic_references_command(
    strict: bool = typer.Option(
        True,
        "--strict/--lenient",
        help="Fail on invalid topic references",
    ),
    format: ResultFormat = typer.Option(
        ResultFormat.TEXT,
        "--format",
        "-f",
        help="Summary output format",
        case_sensitive=False,
    ),
) -> None:
    """Validate that all feed topics exist in ``topics.yaml``."""
    result, ok = _run_topic_reference_validation(strict=strict)
    render_result(result, format=format)
    if not ok:
        raise typer.Exit(code=int(ExitCode.VALIDATION_ERROR))


@app.command("all")
def validate_all(
    strict: bool = typer.Option(True, "--strict/--lenient", help="Strict validation mode"),
) -> None:
    """Run all validation checks."""
    console.print("🔍 Running all validations...\n")

    exit_code = 0

    # Validate feeds schema
    try:
        console.print("1. Validating feeds.yaml schema...")
        validate_feeds(strict=strict)
    except SystemExit as e:
        exit_code = cast(int, e.code or 1)

    # Validate topics schema
    try:
        console.print("\n2. Validating topics.yaml schema...")
        validate_topics()
    except SystemExit as e:
        exit_code = cast(int, e.code or 1)

    # Validate references
    try:
        console.print("\n3. Validating topic references...")
        validate_topic_references()
    except SystemExit as e:
        exit_code = cast(int, e.code or 1)

    if exit_code == 0:
        console.print("\n[green]✅ All validations passed![/green]")
    else:
        console.print("[bold]Validation suite[/bold]")
        for name, result, _ in checks:
            render_result(result, title=name)
            console.print()

    if not ok:
        raise typer.Exit(code=int(ExitCode.VALIDATION_ERROR))


@app.command("url")
def validate_url_command(
    feed_url: str = typer.Argument(..., help="Feed URL to validate"),
    timeout: float = typer.Option(
        30.0,
        "--timeout",
        "-t",
        help="HTTP timeout in seconds",
    ),
    format: ResultFormat = typer.Option(
        ResultFormat.TEXT,
        "--format",
        "-f",
        help="Summary output format",
        case_sensitive=False,
    ),
) -> None:
    """Validate a raw feed URL without requiring a database entry."""
    result, ok = _run_url_validation(feed_url, timeout=timeout)
    render_result(result, format=format)
    if not ok:
        raise typer.Exit(code=int(ExitCode.VALIDATION_ERROR))


@app.command("http")
def validate_http_feeds(
    database_url: str = typer.Option(
        DEFAULT_DATABASE_URL,
        "--database",
        "-d",
        help="Database URL (defaults to AIWF_DATABASE_URL)",
    ),
    concurrency: int = typer.Option(
        10,
        "--concurrency",
        "-c",
        help="Maximum concurrent HTTP requests",
    ),
    feed_id: str | None = typer.Option(
        None,
        "--feed-id",
        help="Validate a specific stored feed ID",
    ),
) -> None:
    """Validate feed URLs with HTTP accessibility checks."""
    console.print("[bold]HTTP Feed Validation[/bold]\n")

    # Initialize database
    db = DatabaseManager(database_url)
    if feed_id:
        feed_source = db.get_feed_source(feed_id)
        if feed_source is None:
            render_result(
                CommandResult(
                    status="error",
                    summary=f"Stored feed '{feed_id}' was not found",
                    details={"database": database_url},
                ),
                format=format,
            )
            raise typer.Exit(code=int(ExitCode.VALIDATION_ERROR))
        feed_sources = [feed_source]
    else:
        feed_sources = db.get_all_feed_sources()

    # Run async validation
    async def run_validation() -> list[Any]:
        return await validate_all_feeds(
            feed_sources,
            concurrency_limit=concurrency,
            show_progress=True,
        )
        return

    validation_results = asyncio.run(
        validate_all_feeds(feed_sources, concurrency_limit=concurrency, show_progress=True)
    )
    for result in validation_results:
        db.add_validation_result(result)

    success_count = sum(1 for result in validation_results if result.success)
    failure_count = len(validation_results) - success_count
    response_times = [
        result.response_time_ms
        for result in validation_results
        if result.response_time_ms is not None
    ]
    avg_response = round(sum(response_times) / len(response_times), 1) if response_times else None

    console.print(f"Total Feeds:     {len(validation_results)}")
    console.print(f"[green]Successful:      {success_count} ({success_rate:.1f}%)[/green]")
    console.print(f"[red]Failed:          {failure_count} ({100 - success_rate:.1f}%)[/red]")

    # Average response time
    response_times = [r.response_time_ms for r in validation_results if r.response_time_ms]
    if response_times:
        avg_response = sum(response_times) / len(response_times)
        console.print(f"Avg Response:    {avg_response:.0f}ms")

    # Error summary
    if failure_count > 0:
        console.print("\n[bold]Top Errors:[/bold]")
        error_counts: dict[str, int] = {}
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
        DEFAULT_DATABASE_URL,
        "--database",
        "-d",
        help="Database URL (defaults to AIWF_DATABASE_URL)",
    ),
    recent: int = typer.Option(
        10,
        "--recent",
        "-n",
        help="Number of recent validations to analyse per feed",
    ),
) -> None:
    """Generate comprehensive validation health report."""
    console.print("[bold]Validation Health Report[/bold]\n")

    # Initialize database
    db = DatabaseManager(database_url)
    feed_sources = db.get_all_feed_sources()

    if not feed_sources:
        render_result(
            CommandResult(
                status="warning",
                summary="No stored feeds were found",
                details={"database": database_url},
            )
        )
        return

    health_data = []
    for feed in feed_sources:
        history = db.get_validation_history(feed.id, limit=recent)
        if not history:
            continue
        success_count = sum(1 for result in history if result.success)
        success_rate = (success_count / len(history)) * 100
        health_data.append(
            {
                "id": feed.id,
                "title": feed.title[:40],
                "health": calculate_health_score(history, max_results=recent),
                "success_rate": success_rate,
                "validations": len(history),
                "verified": feed.verified,
            }
        )

    if not health_data:
        render_result(
            CommandResult(
                status="warning",
                summary="No validation history was found",
                details={"database": database_url},
            )
        )
        return

    health_data.sort(key=lambda item: item["health"], reverse=True)
    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("Feed ID", style="cyan")
    table.add_column("Title")
    table.add_column("Health", justify="right")
    table.add_column("Success Rate", justify="right")
    table.add_column("Checks", justify="right")
    table.add_column("Verified", justify="center")

    for item in health_data[:20]:
        table.add_row(
            item["id"],
            item["title"],
            f"{item['health']:.2f}",
            f"{item['success_rate']:.0f}%",
            str(item["validations"]),
            "✓" if item["verified"] else "✗",
        )

    console.print(table)

    # Summary stats
    avg_health = sum(d["health"] for d in health_data) / len(health_data)
    healthy_feeds = sum(1 for d in health_data if d["health"] >= 0.8)

    console.print("\n[bold]Summary:[/bold]")
    console.print(f"Average Health Score: {avg_health:.2f}")
    console.print(
        f"Healthy Feeds (≥0.8): {healthy_feeds} ({healthy_feeds / len(health_data) * 100:.1f}%)"
    )
    console.print(f"Total Feeds Analyzed: {len(health_data)}")

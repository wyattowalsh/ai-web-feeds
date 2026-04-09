"""Validate feed documents, topic data, and feed URLs."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import typer
import yaml
from rich.table import Table

from ai_web_feeds import DatabaseManager, load_feeds, load_topics
from ai_web_feeds.cli.support import (
    CommandResult,
    ExitCode,
    ResultFormat,
    console,
    get_sources,
    normalize_feed_document,
    render_result,
)
from ai_web_feeds.config import default_data_dir, resolve_runtime_database_url
from ai_web_feeds.validate import (
    calculate_health_score,
    validate_all_feeds,
    validate_feed_url,
    validate_feeds as core_validate_feeds,
    validate_topics as core_validate_topics,
)

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


def _resolve_feeds_input(
    input_path: Path | None, schema_path: Path | None
) -> tuple[Path, Path | None]:
    data_dir = get_data_dir()
    resolved_input = input_path or data_dir / "feeds.yaml"
    default_schema = data_dir / "feeds.schema.json"
    resolved_schema = schema_path or (default_schema if default_schema.exists() else None)
    return resolved_input, resolved_schema


def _resolve_topics_input(
    input_path: Path | None, schema_path: Path | None
) -> tuple[Path, Path | None]:
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


def _run_topic_document_validation(
    *,
    input_path: Path | None,
    schema_path: Path | None,
    strict: bool,
) -> tuple[CommandResult, bool]:
    resolved_input, resolved_schema = _resolve_topics_input(input_path, schema_path)
    if not resolved_input.exists():
        return (
            CommandResult(
                status="error",
                summary="Topic document not found",
                details={"input": str(resolved_input)},
            ),
            False,
        )
    if resolved_schema is not None and not resolved_schema.exists():
        return (
            CommandResult(
                status="error",
                summary="Topic schema not found",
                details={"schema": str(resolved_schema)},
            ),
            False,
        )

    try:
        topics_data = load_topics(resolved_input)
        validation = core_validate_topics(topics_data, resolved_schema)
    except Exception as exc:
        return (
            CommandResult(
                status="error",
                summary="Topic validation failed unexpectedly",
                details={"input": str(resolved_input), "error": str(exc)},
            ),
            False,
        )

    is_ok = validation.valid or not strict
    return (
        CommandResult(
            status="success" if validation.valid else ("warning" if is_ok else "error"),
            summary="Topic document validation passed"
            if validation.valid
            else "Topic document validation reported issues",
            details={
                "input": str(resolved_input),
                "schema": str(resolved_schema) if resolved_schema else None,
                "strict": strict,
                "errors": validation.errors,
            },
        ),
        is_ok,
    )


def _run_topic_reference_validation(*, strict: bool) -> tuple[CommandResult, bool]:
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

    valid_topics: set[str] = set()
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
def validate_all_command(
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
    """Run feed, topic, and reference validation checks."""
    checks = [
        ("feeds", *_run_feed_document_validation(input_path=None, schema_path=None, strict=strict)),
        (
            "topics",
            *_run_topic_document_validation(input_path=None, schema_path=None, strict=strict),
        ),
        ("references", *_run_topic_reference_validation(strict=strict)),
    ]
    ok = all(check_ok for _, _, check_ok in checks)

    if format == ResultFormat.JSON:
        console.print(
            json.dumps(
                {
                    "status": "success" if ok else "error",
                    "summary": "Validation suite complete",
                    "checks": [result.to_dict() | {"name": name} for name, result, _ in checks],
                },
                indent=2,
                sort_keys=True,
                default=str,
            )
        )
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
def validate_http_feeds_command(
    database_url: str | None = typer.Option(
        None,
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
    format: ResultFormat = typer.Option(
        ResultFormat.TEXT,
        "--format",
        "-f",
        help="Summary output format",
        case_sensitive=False,
    ),
) -> None:
    """Validate stored feeds for HTTP accessibility."""
    database_url = resolve_runtime_database_url(database_url)
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

    if not feed_sources:
        render_result(
            CommandResult(
                status="warning",
                summary="No stored feeds were found",
                details={"database": database_url},
            ),
            format=format,
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

    summary = CommandResult(
        status="success" if failure_count == 0 else "warning",
        summary="Stored feed HTTP validation complete",
        details={
            "database": database_url,
            "validated": len(validation_results),
            "successful": success_count,
            "failed": failure_count,
            "avg_response_ms": avg_response,
        },
    )
    render_result(summary, format=format)
    if failure_count:
        raise typer.Exit(code=int(ExitCode.VALIDATION_ERROR))


@app.command("report")
def validation_report(
    database_url: str | None = typer.Option(
        None,
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
    """Generate a validation health report for stored feeds."""
    database_url = resolve_runtime_database_url(database_url)
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

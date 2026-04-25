"""Typer entrypoint for the ai-web-feeds CLI."""

from __future__ import annotations

from pathlib import Path

import typer
from ai_web_feeds.config import DEFAULT_DATABASE_URL
from loguru import logger

from ai_web_feeds.cli import commands as command_modules
from ai_web_feeds import (
    DatabaseManager,
    enrich_all_feeds,
    export_all_formats,
    load_feeds,
    save_feeds,
)

# Import command modules
from ai_web_feeds.cli.commands import analytics, corpus, monitor, recommend, search

app = typer.Typer(
    name="ai-web-feeds",
    help=(
        "ai-web-feeds CLI for feed loading, validation, enrichment, export, "
        "analytics, discovery, and monitoring."
    ),
    add_completion=False,
    no_args_is_help=True,
)
cli = app

# Register command modules
app.add_typer(analytics.app, name="analytics")
app.add_typer(corpus.app, name="corpus")
app.add_typer(search.app, name="search")
app.add_typer(recommend.app, name="recommend")
app.add_typer(monitor.app, name="monitor")

def _register_command_group(command_name: str, *, optional: bool = False) -> None:
    """Register a command group Typer app from the command package."""
    loader = (
        command_modules.load_optional_command_module
        if optional
        else command_modules.load_command_module
    )
    module = loader(command_name)
    if module is None:
        return

    command_app = getattr(module, "app", None)
    if command_app is None:
        logger.warning(f"Command group '{command_name}' does not expose a Typer app")
        return

    app.add_typer(command_app, name=command_name)


for command_name in command_modules.CORE_COMMAND_MODULES:
    _register_command_group(command_name)

for command_name in command_modules.OPTIONAL_COMMAND_MODULES:
    _register_command_group(command_name, optional=True)


@app.command()
def process(
    input_file: Path = typer.Option(
        default_data_path("feeds.yaml"),
        "--input",
        "-i",
        help="Input feeds YAML file",
    ),
    output_file: Path = typer.Option(
        default_data_path("feeds.enriched.yaml"),
        "--output",
        "-o",
        help="Output enriched YAML file",
    ),
    schema_file: Path | None = typer.Option(
        None,
        "--schema",
        "-s",
        help="JSON schema file for validation",
    ),
    database_url: str | None = typer.Option(
        None,
        "--database",
        "-d",
        help="Database URL for storage (defaults to AIWF_DATABASE_URL)",
    ),
    export_formats: bool = typer.Option(
        True,
        "--export/--no-export",
        help="Export JSON and OPML artifacts after enrichment",
    ),
    skip_validation: bool = typer.Option(
        False,
        "--skip-validation",
        help="Skip validation steps",
    ),
    skip_enrichment: bool = typer.Option(
        False,
        "--skip-enrichment",
        help="Skip enrichment",
    ),
) -> None:
    """Run the end-to-end feed processing pipeline."""
    database_url = resolve_runtime_database_url(database_url)
    console.print("\n[bold blue]ai-web-feeds processing pipeline[/bold blue]\n")

    try:
        loaded_data = load_feeds(input_file)
    except Exception as exc:
        render_result(
            CommandResult(
                status="error",
                summary="Failed to load feed document",
                details={"input": str(input_file), "error": str(exc)},
            )
        )
        raise typer.Exit(code=int(ExitCode.RUNTIME_ERROR)) from exc

    feeds_data = dict(loaded_data)
    sources = []
    for source in get_sources(loaded_data):
        normalized = dict(source)
        normalized.update(normalize_source_for_feed_source(source))
        sources.append(normalized)
    feeds_data["sources"] = sources

    console.print(f"[green]✓[/green] Loaded {len(sources)} sources from {input_file}")

    if not skip_validation:
        console.print("[bold]Validating input document...[/bold]")
        validation = core_validate_feeds(feeds_data, schema_file)
        if not validation.valid:
            render_result(
                CommandResult(
                    status="error",
                    summary="Input validation failed",
                    details={"errors": validation.errors, "input": str(input_file)},
                )
            )
            raise typer.Exit(code=int(ExitCode.VALIDATION_ERROR))
        console.print("[green]✓[/green] Input validation passed")

    if not skip_enrichment:
        console.print("[bold]Enriching sources...[/bold]")
        try:
            db = DatabaseManager(database_url)
            db.create_db_and_tables()
            feeds_data = enrich_all_feeds(feeds_data, db=db)
        except Exception as exc:
            logger.exception("Enrichment error")
            render_result(
                CommandResult(
                    status="error",
                    summary="Enrichment failed",
                    details={"database": database_url, "error": str(exc)},
                )
            )
            raise typer.Exit(code=int(ExitCode.RUNTIME_ERROR)) from exc
        console.print("[green]✓[/green] Enrichment complete")

    if not skip_validation:
        console.print("[bold]Validating enriched output...[/bold]")
        post_validation = core_validate_feeds(feeds_data, schema_file)
        if not post_validation.valid:
            render_result(
                CommandResult(
                    status="warning",
                    summary="Enriched output has validation warnings",
                    details={"errors": post_validation.errors},
                )
            )
        else:
            console.print("[green]✓[/green] Enriched output validation passed")

    console.print("[bold]Writing outputs...[/bold]")
    save_feeds(feeds_data, output_file)
    if export_formats:
        export_all_formats(feeds_data, output_file.parent, output_file.stem)

    stored_count = 0
    storage_errors: list[str] = []
    try:
        db = DatabaseManager(database_url)
        db.create_db_and_tables()

        from ai_web_feeds.models import FeedSource

        for source_data in get_sources(feeds_data):
            try:
                normalized = normalize_source_for_feed_source(source_data)
                db.add_feed_source(
                    FeedSource(
                        id=normalized["id"],
                        feed=normalized["feed"],
                        site=normalized["site"],
                        title=normalized["title"],
                        source_type=normalized["source_type"],
                        mediums=source_data.get("mediums", []),
                        topics=normalized["topics"],
                        language=source_data.get("language"),
                        curation_status=source_data.get("curation_status"),
                        notes=normalized["notes"],
                        tags=normalized["tags"],
                        topic_weights=source_data.get("topic_weights", {}),
                    )
                )
                stored_count += 1
            except Exception as exc:
                storage_errors.append(str(exc))
                logger.warning(f"Failed to store source {source_data.get('id', 'unknown')}: {exc}")
    except Exception as exc:
        render_result(
            CommandResult(
                status="error",
                summary="Database storage failed",
                details={"database": database_url, "error": str(exc)},
            )
        )
        raise typer.Exit(code=int(ExitCode.RUNTIME_ERROR)) from exc

    render_result(
        CommandResult(
            status="warning" if storage_errors else "success",
            summary="Processing complete",
            details={
                "input": str(input_file),
                "output": str(output_file),
                "exported": export_formats,
                "database": database_url,
                "sources_processed": len(get_sources(feeds_data)),
                "sources_stored": stored_count,
                "storage_errors": storage_errors,
            },
        )
    )

    if storage_errors:
        raise typer.Exit(code=int(ExitCode.VALIDATION_ERROR))


@app.callback()
def callback() -> None:
    """AI Web Feeds CLI."""


def main() -> None:
    """Entry point for the CLI."""
    app()


if __name__ == "__main__":
    main()

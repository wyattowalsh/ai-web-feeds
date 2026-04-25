"""Enrich feed sources with discovered metadata."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from pathlib import Path

import typer
import yaml  # type: ignore[import-untyped]
from loguru import logger

from ai_web_feeds.config import default_data_path, resolve_runtime_database_url
from ai_web_feeds.models import FeedSource
from ai_web_feeds.storage import DatabaseManager
from ai_web_feeds.utils import (
    enrich_feed_source,
    generate_enriched_schema,
    load_feeds_yaml,
    save_feeds_yaml,
    save_json_schema,
)
from ai_web_feeds.cli.support import (
    CommandResult,
    ExitCode,
    get_sources,
    normalize_feed_document,
    render_result,
)

app = typer.Typer(
    help="Enrich feed sources with metadata",
    invoke_without_command=True,
    no_args_is_help=True,
)
cli = app


@app.callback()
def callback(
    ctx: typer.Context,
    input_path: Path | None = typer.Argument(None, help="Input feeds YAML file"),
    output_path: Path | None = typer.Option(
        None,
        "--output",
        "-o",
        help="Output enriched YAML file",
    ),
    schema_path: Path = typer.Option(
        default_data_path("feeds.enriched.schema.json"),
        "--schema",
        "-s",
        help="Output JSON schema file",
    ),
    database_url: str | None = typer.Option(
        None,
        "--database",
        "-d",
        help="Database URL (defaults to AIWF_DATABASE_URL)",
    ),
) -> None:
    """Support ``ai-web-feeds enrich <file>`` as a compatibility alias."""
    if ctx.invoked_subcommand is not None or input_path is None:
        return
    enrich_all(
        input_path=input_path,
        output_path=output_path or input_path.parent / f"{input_path.stem}.enriched.yaml",
        schema_path=schema_path,
        database_url=database_url,
    )


@app.command("all")
def enrich_all(
    input_path: Path = typer.Option(
        default_data_path("feeds.yaml"),
        "--input",
        "-i",
        help="Input feeds YAML file",
    ),
    output_path: Path = typer.Option(
        default_data_path("feeds.enriched.yaml"),
        "--output",
        "-o",
        help="Output enriched YAML file",
    ),
    schema_path: Path = typer.Option(
        default_data_path("feeds.enriched.schema.json"),
        "--schema",
        "-s",
        help="Output JSON schema file",
    ),
    database_url: str | None = typer.Option(
        None,
        "--database",
        "-d",
        help="Database URL (defaults to AIWF_DATABASE_URL)",
    ),
) -> None:
    """Enrich all feed sources and save the results."""
    database_url = resolve_runtime_database_url(database_url)
    feeds_data = normalize_feed_document(load_feeds_yaml(input_path))
    sources = get_sources(feeds_data)

    enriched_sources = []
    errors: list[str] = []
    for source in sources:
        try:
            enriched_sources.append(asyncio.run(enrich_feed_source(source)))
        except Exception as exc:
            source_id = source.get("id", source.get("url", "unknown"))
            logger.error(f"Failed to enrich {source_id}: {exc}")
            errors.append(f"{source_id}: {exc}")
            enriched_sources.append(source)

    enriched_data = {
        "schema_version": "feeds-enriched-1.0.0",
        "document_meta": {
            **feeds_data.get("document_meta", {}),
            "enriched_at": datetime.now(UTC).isoformat(),
            "total_sources": len(enriched_sources),
        },
        "sources": enriched_sources,
    }

    save_feeds_yaml(enriched_data, output_path)
    save_json_schema(generate_enriched_schema(), schema_path)

    db = DatabaseManager(database_url)
    db.create_db_and_tables()
    for source_data in enriched_sources:
        try:
            db.add_feed_source(
                FeedSource(
                    id=source_data["id"],
                    feed=source_data.get("feed"),
                    site=source_data.get("site"),
                    title=source_data["title"],
                    source_type=source_data.get("source_type"),
                    mediums=source_data.get("mediums", []),
                    tags=source_data.get("tags", []),
                    topics=source_data.get("topics", []),
                    topic_weights=source_data.get("topic_weights", {}),
                    language=source_data.get("meta", {}).get("language"),
                    format=source_data.get("meta", {}).get("format"),
                    verified=source_data.get("meta", {}).get("verified", False),
                    contributor=source_data.get("meta", {}).get("contributor"),
                    curation_status=source_data.get("curation", {}).get("status"),
                    quality_score=source_data.get("curation", {}).get("quality_score"),
                    curation_notes=source_data.get("curation", {}).get("notes"),
                    provenance_source=source_data.get("provenance", {}).get("source"),
                    provenance_from=source_data.get("provenance", {}).get("from"),
                    provenance_license=source_data.get("provenance", {}).get("license"),
                    relations=source_data.get("relations", {}),
                    mappings=source_data.get("mappings", {}),
                    notes=source_data.get("notes"),
                )
            )
        except Exception as exc:
            errors.append(f"{source_data.get('id', 'unknown')}: {exc}")
            logger.error(f"Failed to save enriched source: {exc}")

    render_result(
        CommandResult(
            status="warning" if errors else "success",
            summary="Enrichment complete",
            details={
                "input": str(input_path),
                "output": str(output_path),
                "schema": str(schema_path),
                "database": database_url,
                "sources": len(enriched_sources),
                "errors": errors,
            },
        )
    )

    if errors:
        raise typer.Exit(code=int(ExitCode.VALIDATION_ERROR))


@app.command("one")
def enrich_one(
    feed_id: str = typer.Argument(..., help="Feed ID to enrich"),
    input_path: Path = typer.Option(
        Path("data/feeds.yaml"),
        "--input",
        "-i",
        help="Input feeds YAML file",
    ),
) -> None:
    """Preview enrichment for a single feed source."""
    feeds_data = normalize_feed_document(load_feeds_yaml(input_path))
    feed = next((source for source in get_sources(feeds_data) if source.get("id") == feed_id), None)
    if feed is None:
        render_result(
            CommandResult(
                status="error",
                summary=f"Feed '{feed_id}' was not found",
                details={"input": str(input_path)},
            )
        )
        raise typer.Exit(code=int(ExitCode.VALIDATION_ERROR))

    enriched = asyncio.run(enrich_feed_source(feed))

    # Pretty print the enriched data
    typer.echo(yaml.dump(enriched, default_flow_style=False, sort_keys=False))

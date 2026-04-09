"""Generate OPML files from stored feed sources."""

from pathlib import Path

import typer
from loguru import logger

from ai_web_feeds.config import (
    default_data_path,
    resolve_runtime_database_url,
)
from ai_web_feeds.cli.support import CommandResult, ExitCode, render_result
from ai_web_feeds.storage import DatabaseManager
from ai_web_feeds.utils import (
    generate_categorized_opml,
    generate_filtered_opml,
    generate_opml,
    save_opml,
)

app = typer.Typer(help="Generate OPML files from feed sources")
cli = app


@app.command("all")
def generate_all_opml(
    output_path: Path = typer.Option(
        default_data_path("all.opml"),
        "--output",
        "-o",
        help="Output OPML file",
    ),
    db_path: str | None = typer.Option(
        None,
        "--database",
        "-d",
        help="Database URL (defaults to AIWF_DATABASE_URL)",
    ),
):
    """Generate OPML file with all feeds."""
    db_path = resolve_runtime_database_url(db_path)
    db = DatabaseManager(db_path)
    feed_sources = db.get_all_feed_sources()

    if not feed_sources:
        render_result(
            CommandResult(
                status="error",
                summary="No feed sources were found in the database",
                details={"database": db_path},
            )
        )
        raise typer.Exit(code=int(ExitCode.VALIDATION_ERROR))

    logger.info(f"Generating OPML for {len(feed_sources)} feeds")
    opml_xml = generate_opml(feed_sources, title="AI Web Feeds - All Feeds")

    save_opml(opml_xml, output_path)
    render_result(
        CommandResult(
            status="success",
            summary="Generated flat OPML export",
            details={"output": str(output_path), "feeds": len(feed_sources)},
        )
    )


@app.command("categorized")
def generate_categorized_opml_cmd(
    output_path: Path = typer.Option(
        default_data_path("categorized.opml"),
        "--output",
        "-o",
        help="Output OPML file",
    ),
    db_path: str | None = typer.Option(
        None,
        "--database",
        "-d",
        help="Database URL (defaults to AIWF_DATABASE_URL)",
    ),
):
    """Generate categorized OPML file (by source type)."""
    db_path = resolve_runtime_database_url(db_path)
    db = DatabaseManager(db_path)
    feed_sources = db.get_all_feed_sources()

    if not feed_sources:
        render_result(
            CommandResult(
                status="error",
                summary="No feed sources were found in the database",
                details={"database": db_path},
            )
        )
        raise typer.Exit(code=int(ExitCode.VALIDATION_ERROR))

    logger.info(f"Generating categorized OPML for {len(feed_sources)} feeds")
    opml_xml = generate_categorized_opml(feed_sources, title="AI Web Feeds - Categorized")

    save_opml(opml_xml, output_path)
    render_result(
        CommandResult(
            status="success",
            summary="Generated categorized OPML export",
            details={"output": str(output_path), "feeds": len(feed_sources)},
        )
    )


@app.command("filtered")
def generate_filtered_opml_cmd(
    output_path: Path = typer.Argument(..., help="Output OPML file"),
    topic: str = typer.Option(None, "--topic", "-t", help="Filter by topic"),
    source_type: str = typer.Option(None, "--type", "-T", help="Filter by source type"),
    tag: str = typer.Option(None, "--tag", "-g", help="Filter by tag"),
    verified_only: bool = typer.Option(False, "--verified", "-v", help="Only verified feeds"),
    db_path: str | None = typer.Option(
        None,
        "--database",
        "-d",
        help="Database URL (defaults to AIWF_DATABASE_URL)",
    ),
):
    """Generate filtered OPML file based on criteria."""
    db_path = resolve_runtime_database_url(db_path)
    db = DatabaseManager(db_path)
    feed_sources = db.get_all_feed_sources()

    if not feed_sources:
        render_result(
            CommandResult(
                status="error",
                summary="No feed sources were found in the database",
                details={"database": db_path},
            )
        )
        raise typer.Exit(code=int(ExitCode.VALIDATION_ERROR))

    # Build filter function
    def filter_fn(feed):
        if topic and topic not in feed.topics:
            return False
        if source_type and feed.source_type != source_type:
            return False
        if tag and tag not in feed.tags:
            return False
        if verified_only and not feed.verified:
            return False
        return True

    # Generate title
    title_parts = ["AI Web Feeds"]
    if topic:
        title_parts.append(f"Topic: {topic}")
    if source_type:
        title_parts.append(f"Type: {source_type}")
    if tag:
        title_parts.append(f"Tag: {tag}")
    if verified_only:
        title_parts.append("Verified Only")
    title = " - ".join(title_parts)

    logger.info(f"Generating filtered OPML: {title}")
    opml_xml = generate_filtered_opml(feed_sources, title=title, filter_fn=filter_fn)

    save_opml(opml_xml, output_path)

    # Count filtered feeds
    filtered_count = len([f for f in feed_sources if filter_fn(f)])
    render_result(
        CommandResult(
            status="success",
            summary="Generated filtered OPML export",
            details={
                "output": str(output_path),
                "feeds": filtered_count,
                "topic": topic,
                "source_type": source_type,
                "tag": tag,
                "verified_only": verified_only,
            },
        )
    )

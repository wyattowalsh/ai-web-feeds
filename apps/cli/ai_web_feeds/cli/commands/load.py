"""Load feed data into the database."""

from __future__ import annotations

from pathlib import Path

import typer
from loguru import logger
from rich.progress import track

from ai_web_feeds import DatabaseManager, load_feeds
from ai_web_feeds.config import (
    default_data_path,
    resolve_runtime_database_url,
)
from ai_web_feeds.load import normalize_source_for_feed_source
from ai_web_feeds.cli.support import CommandResult, ExitCode, get_sources, render_result

app = typer.Typer(help="Load feeds from YAML into the database", no_args_is_help=True)
cli = app


@app.command("from-yaml")
def from_yaml(
    input_path: Path = typer.Option(
        default_data_path("feeds.yaml"),
        "--input",
        "-i",
        help="Input YAML file",
    ),
    database_url: str | None = typer.Option(
        None,
        "--database",
        "-d",
        help="Database URL (defaults to AIWF_DATABASE_URL)",
    ),
    clear_existing: bool = typer.Option(
        False,
        "--clear/--keep-existing",
        help="Clear existing feeds before loading",
    ),
    verbose: bool = typer.Option(
        False,
        "--verbose",
        "-v",
        help="Show per-feed progress while loading",
    ),
) -> None:
    """Load feeds from a YAML file into the database."""
    database_url = resolve_runtime_database_url(database_url)
    try:
        feeds_data = load_feeds(input_path)
        sources = get_sources(feeds_data)
    except FileNotFoundError as exc:
        render_result(
            CommandResult(
                status="error",
                summary="Feed document not found",
                details={"input": str(input_path), "error": str(exc)},
            )
        )
        raise typer.Exit(code=int(ExitCode.RUNTIME_ERROR)) from exc
    except Exception as exc:
        logger.exception("Feed load failed")
        render_result(
            CommandResult(
                status="error",
                summary="Failed to read feed document",
                details={"input": str(input_path), "error": str(exc)},
            )
        )
        raise typer.Exit(code=int(ExitCode.RUNTIME_ERROR)) from exc

    if not sources:
        render_result(
            CommandResult(
                status="warning",
                summary="No feed sources were found in the input document",
                details={"input": str(input_path)},
            )
        )
        return

    db = DatabaseManager(database_url)
    db.create_db_and_tables()

    if clear_existing:
        with db.get_session() as session:
            from ai_web_feeds.models import FeedSource
            from sqlmodel import delete

            session.exec(delete(FeedSource))
            session.commit()

    from ai_web_feeds.models import FeedSource

    success_count = 0
    errors: list[str] = []
    iterator = track(sources, description="Loading feeds...", disable=not verbose)
    for source_data in iterator:
        try:
            normalized = normalize_source_for_feed_source(source_data)
            db.add_feed_source(
                FeedSource(
                    id=normalized["id"],
                    feed=normalized["feed"],
                    site=normalized["site"],
                    title=normalized["title"],
                    source_type=normalized["source_type"],
                    verified=source_data.get("verified", False),
                    topics=normalized["topics"],
                    tags=normalized["tags"],
                    notes=normalized["notes"],
                )
            )
            success_count += 1
        except Exception as exc:
            errors.append(f"{source_data.get('id', source_data.get('url', 'unknown'))}: {exc}")
            logger.warning(f"Failed to load feed source: {exc}")

    render_result(
        CommandResult(
            status="warning" if errors else "success",
            summary="Loaded feed sources into the database",
            details={
                "input": str(input_path),
                "database": database_url,
                "loaded": success_count,
                "failed": len(errors),
                "errors": errors,
            },
        )
    )

    if errors:
        raise typer.Exit(code=int(ExitCode.VALIDATION_ERROR))


@app.command("all")
def load_all(
    input_path: Path = typer.Option(
        default_data_path("feeds.yaml"),
        "--input",
        "-i",
        help="Input YAML file",
    ),
    database_url: str | None = typer.Option(
        None,
        "--database",
        "-d",
        help="Database URL (defaults to AIWF_DATABASE_URL)",
    ),
    verbose: bool = typer.Option(
        False,
        "--verbose",
        "-v",
        help="Show per-feed progress while loading",
    ),
) -> None:
    """Alias for ``from-yaml``."""
    database_url = resolve_runtime_database_url(database_url)
    from_yaml(
        input_path=input_path,
        database_url=database_url,
        clear_existing=False,
        verbose=verbose,
    )

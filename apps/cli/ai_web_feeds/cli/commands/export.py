"""Export feed data in various formats."""

from __future__ import annotations

import json
from pathlib import Path

import typer
from loguru import logger

from ai_web_feeds import export_all_formats, export_to_opml, load_feeds
from ai_web_feeds.config import default_data_dir, default_data_path
from ai_web_feeds.cli.support import CommandResult, ExitCode, get_sources, render_result

app = typer.Typer(
    help="Export feed documents as JSON and OPML",
    invoke_without_command=True,
    no_args_is_help=True,
    context_settings={"allow_extra_args": True},
)
cli = app


@app.callback()
def callback(
    ctx: typer.Context,
    output_dir: Path = typer.Option(
        default_data_dir(),
        "--output-dir",
        "-o",
        help="Output directory for exported files",
    ),
    prefix: str | None = typer.Option(
        None,
        "--prefix",
        "-p",
        help="Output filename prefix (defaults to the input filename)",
    ),
) -> None:
    """Support ``ai-web-feeds export <file>`` as a compatibility alias."""
    if ctx.invoked_subcommand is not None:
        return

    if not ctx.args:
        return
    if len(ctx.args) > 1:
        raise typer.BadParameter(
            "Expected a single input feeds YAML file when using the export compatibility alias."
        )

    export_all_command(input_path=Path(ctx.args[0]), output_dir=output_dir, prefix=prefix)


def _load_document(input_path: Path) -> dict:
    loaded = load_feeds(input_path)
    return {
        **loaded,
        "sources": get_sources(loaded),
    }


@app.command("json")
def export_json(
    input_path: Path = typer.Option(
        default_data_path("feeds.yaml"),
        "--input",
        "-i",
        help="Input YAML file",
    ),
    output_path: Path = typer.Option(
        default_data_path("feeds.json"),
        "--output",
        "-o",
        help="Output JSON file",
    ),
    pretty: bool = typer.Option(
        True,
        "--pretty/--compact",
        help="Pretty-print JSON output",
    ),
) -> None:
    """Export feed data as JSON."""
    try:
        feeds_data = _load_document(input_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w", encoding="utf-8") as handle:
            json.dump(
                feeds_data,
                handle,
                ensure_ascii=False,
                indent=2 if pretty else None,
                separators=None if pretty else (",", ":"),
            )
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
        logger.exception("JSON export failed")
        render_result(
            CommandResult(
                status="error",
                summary="JSON export failed",
                details={"output": str(output_path), "error": str(exc)},
            )
        )
        raise typer.Exit(code=int(ExitCode.RUNTIME_ERROR)) from exc

    render_result(
        CommandResult(
            status="success",
            summary="Exported feed document as JSON",
            details={
                "input": str(input_path),
                "output": str(output_path),
                "sources": len(get_sources(feeds_data)),
                "pretty": pretty,
            },
        )
    )


@app.command("opml")
def export_opml(
    input_path: Path = typer.Option(
        default_data_path("feeds.yaml"),
        "--input",
        "-i",
        help="Input YAML file",
    ),
    output_path: Path = typer.Option(
        default_data_path("feeds.opml"),
        "--output",
        "-o",
        help="Output OPML file",
    ),
    categorized: bool = typer.Option(
        False,
        "--categorized",
        "-c",
        help="Group feeds by topic",
    ),
) -> None:
    """Export feed data as OPML."""
    try:
        feeds_data = _load_document(input_path)
        export_to_opml(feeds_data, output_path, categorized=categorized)
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
        logger.exception("OPML export failed")
        render_result(
            CommandResult(
                status="error",
                summary="OPML export failed",
                details={"output": str(output_path), "error": str(exc)},
            )
        )
        raise typer.Exit(code=int(ExitCode.RUNTIME_ERROR)) from exc

    render_result(
        CommandResult(
            status="success",
            summary="Exported feed document as OPML",
            details={
                "input": str(input_path),
                "output": str(output_path),
                "categorized": categorized,
                "sources": len(get_sources(feeds_data)),
            },
        )
    )


@app.command("all")
def export_all_command(
    input_path: Path = typer.Option(
        default_data_path("feeds.yaml"),
        "--input",
        "-i",
        help="Input YAML file",
    ),
    output_dir: Path = typer.Option(
        default_data_dir(),
        "--output-dir",
        "-o",
        help="Output directory for all formats",
    ),
    prefix: str | None = typer.Option(
        None,
        "--prefix",
        "-p",
        help="Output filename prefix (defaults to the input filename)",
    ),
) -> None:
    """Export feed data as JSON plus flat and categorized OPML."""
    try:
        feeds_data = _load_document(input_path)
        resolved_prefix = prefix or input_path.stem
        export_all_formats(feeds_data, output_dir, resolved_prefix)
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
        logger.exception("Export all failed")
        render_result(
            CommandResult(
                status="error",
                summary="Export failed",
                details={"output_dir": str(output_dir), "error": str(exc)},
            )
        )
        raise typer.Exit(code=int(ExitCode.RUNTIME_ERROR)) from exc

    render_result(
        CommandResult(
            status="success",
            summary="Exported feed document in all supported formats",
            details={
                "input": str(input_path),
                "output_dir": str(output_dir),
                "prefix": resolved_prefix,
                "sources": len(get_sources(feeds_data)),
                "artifacts": [
                    str(output_dir / f"{resolved_prefix}.json"),
                    str(output_dir / f"{resolved_prefix}.opml"),
                    str(output_dir / f"{resolved_prefix}.categorized.opml"),
                ],
            },
        )
    )


@app.command("csv")
def export_csv() -> None:
    """Report that CSV export is not implemented."""
    render_result(
        CommandResult(
            status="warning",
            summary="CSV export is not implemented",
            details={
                "hint": "Use `ai-web-feeds export json` and transform the JSON with jq or Python.",
            },
        )
    )
    raise typer.Exit(code=int(ExitCode.NOT_IMPLEMENTED))

"""ai_web_feeds.cli.commands.export -- Export data in various formats"""

import csv
import json
from pathlib import Path
from typing import Any

import typer
from loguru import logger
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

from ai_web_feeds import export_all_formats, export_to_json, export_to_opml, load_feeds
from ai_web_feeds.load import canonicalize_catalog

app = typer.Typer(help="Export feed data in various formats")
console = Console()


@app.command("json")
def export_json(
    input_file: Path = typer.Option(
        Path("data/feeds.yaml"),
        "--input",
        "-i",
        help="Input YAML file",
    ),
    output_file: Path = typer.Option(
        Path("data/feeds.json"),
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
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            progress.add_task(description="Loading feeds...", total=None)
            feeds_data = load_feeds(input_file)

            progress.add_task(description="Exporting to JSON...", total=None)
            export_to_json(feeds_data, output_file)

        count = len(feeds_data.get("sources", []))
        console.print(f"[green]✓[/green] Exported {count} feeds to {output_file}")

    except FileNotFoundError as e:
        console.print(f"[red]✗[/red] File not found: {e}")
        raise typer.Exit(code=1)
    except Exception as e:
        console.print(f"[red]✗[/red] Export failed: {e}")
        logger.exception("JSON export failed")
        raise typer.Exit(code=1)


@app.command("opml")
def export_opml(
    input_file: Path = typer.Option(
        Path("data/feeds.yaml"),
        "--input",
        "-i",
        help="Input YAML file",
    ),
    output_file: Path = typer.Option(
        Path("data/feeds.opml"),
        "--output",
        "-o",
        help="Output OPML file",
    ),
    categorized: bool = typer.Option(
        False,
        "--categorized",
        "-c",
        help="Group feeds by source type",
    ),
) -> None:
    """Export feed data as OPML."""
    try:
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            progress.add_task(description="Loading feeds...", total=None)
            feeds_data = load_feeds(input_file)

            progress.add_task(description="Generating OPML...", total=None)
            export_to_opml(feeds_data, output_file, categorized=categorized)

        count = len(feeds_data.get("sources", []))
        opml_type = "categorized" if categorized else "flat"
        console.print(f"[green]✓[/green] Exported {count} feeds to {output_file} ({opml_type})")

    except FileNotFoundError as e:
        console.print(f"[red]✗[/red] File not found: {e}")
        raise typer.Exit(code=1)
    except Exception as e:
        console.print(f"[red]✗[/red] Export failed: {e}")
        logger.exception("OPML export failed")
        raise typer.Exit(code=1)


@app.command("all")
def export_all(
    input_file: Path = typer.Option(
        Path("data/feeds.yaml"),
        "--input",
        "-i",
        help="Input YAML file",
    ),
    output_dir: Path = typer.Option(
        Path("data"),
        "--output-dir",
        "-o",
        help="Output directory for all formats",
    ),
) -> None:
    """Export feed data in all formats (JSON, OPML, categorized OPML)."""
    try:
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            progress.add_task(description="Loading feeds...", total=None)
            feeds_data = load_feeds(input_file)

            progress.add_task(description="Exporting all formats...", total=None)
            output_prefix = input_file.name.removesuffix(".yaml").removesuffix(".yml")
            export_all_formats(feeds_data, output_dir, prefix=output_prefix)

        count = len(feeds_data.get("sources", []))
        console.print(f"[green]✓[/green] Exported {count} feeds to:")
        console.print(f"  • {output_dir}/{output_prefix}.json")
        console.print(f"  • {output_dir}/{output_prefix}.opml")
        console.print(f"  • {output_dir}/{output_prefix}.categorized.opml")

    except FileNotFoundError as e:
        console.print(f"[red]✗[/red] File not found: {e}")
        raise typer.Exit(code=1)
    except Exception as e:
        console.print(f"[red]✗[/red] Export failed: {e}")
        logger.exception("Export all failed")
        raise typer.Exit(code=1)


@app.command("csv")
def export_csv(
    input_file: Path = typer.Option(
        Path("data/feeds.yaml"),
        "--input",
        "-i",
        help="Input YAML file",
    ),
    output_file: Path = typer.Option(
        Path("data/feeds.csv"),
        "--output",
        "-o",
        help="Output CSV file",
    ),
) -> None:
    """Export feed data as CSV."""
    try:
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            progress.add_task(description="Loading feeds...", total=None)
            feeds_data = canonicalize_catalog(load_feeds(input_file), enriched=False)

            progress.add_task(description="Exporting to CSV...", total=None)
            _export_to_csv(feeds_data, output_file)

        count = len(feeds_data.get("sources", []))
        console.print(f"[green]✓[/green] Exported {count} feeds to {output_file}")

    except FileNotFoundError as e:
        console.print(f"[red]✗[/red] File not found: {e}")
        raise typer.Exit(code=1)
    except Exception as e:
        console.print(f"[red]✗[/red] Export failed: {e}")
        logger.exception("CSV export failed")
        raise typer.Exit(code=1)


def _export_to_csv(data: dict[str, Any], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "id",
        "title",
        "url",
        "feed",
        "site",
        "source_type",
        "topics",
        "tags",
        "mediums",
        "curation_status",
        "verified",
        "language",
        "description",
    ]

    with output_path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for source in data.get("sources", []):
            if not isinstance(source, dict):
                continue
            row = {field: _csv_value(source.get(field)) for field in fieldnames}
            writer.writerow(row)


def _csv_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        return ",".join(str(item) for item in value)
    if isinstance(value, dict):
        return json.dumps(value, sort_keys=True)
    return str(value)

"""ai_web_feeds.cli.commands.add -- Add feed sources to the catalog"""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import typer
from loguru import logger
from rich.console import Console

from ai_web_feeds import load_feeds, save_feeds

app = typer.Typer(help="Add feed sources to the catalog")
console = Console()


def _get_data_dir() -> Path:
    """Get the data directory path by walking up from this file."""
    current = Path(__file__).resolve()
    for parent in current.parents:
        data_dir = parent / "data"
        if data_dir.exists():
            return data_dir
    return Path("data")


def _generate_id_from_url(url: str) -> str:
    """Generate a simple ID from a URL."""
    from hashlib import sha256

    parsed = urlparse(url)
    host = parsed.netloc.removeprefix("www.")
    path = parsed.path.strip("/").replace("/", "-")[:30]
    base = f"{host}-{path}" if path else host
    # Sanitize
    base = "".join(c if c.isalnum() or c in "-_" else "-" for c in base).strip("-")
    digest = sha256(url.encode("utf-8")).hexdigest()[:8]
    return f"{base[:40].rstrip('-') or 'feed'}-{digest}"


def _looks_like_feed_url(url: str) -> bool:
    """Heuristic check if URL looks like a feed or could resolve to one."""
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        return False
    lower = url.lower()
    # Common feed indicators
    if any(x in lower for x in (".xml", ".rss", "/rss", "/feed", "/atom")):
        return True
    return True  # Assume valid http(s) URL can be a source page


@app.command()
def add(
    url: str = typer.Argument(..., help="Feed or site URL to add"),
    title: Optional[str] = typer.Option(
        None,
        "--title",
        "-t",
        help="Display title for the source",
    ),
    topics: Optional[str] = typer.Option(
        None,
        "--topics",
        help="Comma-separated list of topic IDs",
    ),
    tags: Optional[str] = typer.Option(
        None,
        "--tags",
        help="Comma-separated list of tags",
    ),
    input_file: Path = typer.Option(
        None,
        "--input",
        "-i",
        help="Path to feeds.yaml (defaults to data/feeds.yaml)",
    ),
    validate: bool = typer.Option(
        False,
        "--validate/--no-validate",
        help="Run validation after adding",
    ),
    enrich: bool = typer.Option(
        False,
        "--enrich/--no-enrich",
        help="Run enrichment on the new entry",
    ),
) -> None:
    """Add a new feed source URL to the catalog."""
    # Resolve input file
    if input_file is None:
        data_dir = _get_data_dir()
        input_file = data_dir / "feeds.yaml"

    if not input_file.exists():
        console.print(f"[red]Error: {input_file} not found[/red]")
        raise typer.Exit(1)

    # Basic URL validation
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        console.print(f"[red]Error: Invalid URL: {url}[/red]")
        console.print("[dim]Provide a full URL with scheme (http/https)[/dim]")
        raise typer.Exit(1)

    if not _looks_like_feed_url(url):
        console.print(f"[yellow]Warning:[/yellow] URL may not be a feed: {url}")

    # Load existing catalog
    try:
        catalog = load_feeds(input_file)
    except Exception as e:
        console.print(f"[red]Failed to load catalog: {e}[/red]")
        raise typer.Exit(1) from e

    sources = catalog.setdefault("sources", [])

    # Check for duplicates
    existing_urls = set()
    for src in sources:
        for key in ("url", "feed", "site"):
            val = src.get(key)
            if isinstance(val, str):
                existing_urls.add(val.rstrip("/"))

    if url.rstrip("/") in existing_urls:
        console.print(f"[yellow]⚠[/yellow] URL already exists in catalog: {url}")
        # Still proceed to allow adding topics if requested

    # Build new source entry
    source_id = _generate_id_from_url(url)
    new_source: dict[str, object] = {
        "id": source_id,
        "url": url,
        "title": title or url,
    }

    if topics:
        topic_list = [t.strip() for t in topics.split(",") if t.strip()]
        if topic_list:
            new_source["topics"] = topic_list

    if tags:
        tag_list = [t.strip() for t in tags.split(",") if t.strip()]
        if tag_list:
            new_source["tags"] = tag_list

    # Append
    sources.append(new_source)

    # Save
    try:
        save_feeds(catalog, input_file)
        console.print(f"[green]✓[/green] Added source: {source_id}")
        console.print(f"  URL: {url}")
        if topics:
            console.print(f"  Topics: {', '.join(new_source.get('topics', []))}")
        if tags:
            console.print(f"  Tags: {', '.join(new_source.get('tags', []))}")
    except Exception as e:
        console.print(f"[red]Failed to save catalog: {e}[/red]")
        raise typer.Exit(1) from e

    # Optional validate step (reuse validate logic via subprocess-like import)
    if validate:
        console.print("\n[bold]Running validation...[/bold]")
        try:
            from ai_web_feeds.validate import validate_feeds as _validate

            result = _validate(catalog, schema_file=None)
            if result.valid:
                console.print("[green]✓[/green] Validation passed")
            else:
                console.print("[yellow]⚠ Validation warnings:[/yellow]")
                for err in result.errors[:5]:
                    console.print(f"  - {err}")
        except Exception as e:
            console.print(f"[yellow]Validation step skipped: {e}[/yellow]")

    # Optional enrich step
    if enrich:
        console.print("\n[bold]Enriching new source...[/bold]")
        try:
            from ai_web_feeds.enrich import enrich_feed_source as _enrich_one

            enriched = asyncio.run(_enrich_one(new_source))
            # Update the just-added entry in place with enriched data where sensible
            # Merge non-destructive fields back into catalog for immediate visibility
            for src in sources:
                if src.get("id") == source_id:
                    # Preserve user-provided fields; fill discovered ones
                    for k in ("title", "feed", "site", "description", "source_type"):
                        if k in enriched and not src.get(k):
                            src[k] = enriched[k]
                    break
            save_feeds(catalog, input_file)
            console.print(
                "[green]✓[/green] Enrichment complete (metadata may be partial without network)"
            )
        except Exception as e:
            logger.warning("Enrichment failed for add: {}", e)
            console.print(f"[yellow]Enrichment skipped: {e}[/yellow]")

    console.print(f"\n[dim]Catalog: {input_file}[/dim]")

"""ai_web_feeds.cli.commands.enrich -- Enrich feeds with metadata"""

import asyncio
from pathlib import Path

import typer
from loguru import logger

from ai_web_feeds.models import FeedSource
from ai_web_feeds.storage import DatabaseManager
from ai_web_feeds.utils import (
    enrich_feed_source,
    generate_enriched_schema,
    load_feeds_yaml,
    save_feeds_yaml,
    save_json_schema,
)

app = typer.Typer(help="Enrich feed sources with metadata")


@app.command("all")
def enrich_all(
    input_path: Path = typer.Option(
        Path("data/feeds.yaml"),
        "--input",
        "-i",
        help="Input feeds YAML file",
    ),
    output_path: Path = typer.Option(
        Path("data/feeds.enriched.yaml"),
        "--output",
        "-o",
        help="Output enriched YAML file",
    ),
    schema_path: Path = typer.Option(
        Path("data/feeds.enriched.schema.json"),
        "--schema",
        "-s",
        help="Output JSON schema file",
    ),
    db_path: str = typer.Option(
        "sqlite:///data/aiwebfeeds.db",
        "--database",
        "-d",
        help="Database URL",
    ),
):
    """Enrich all feed sources and save to database and YAML."""
    logger.info(f"Loading feeds from {input_path}")

    # Load input feeds
    feeds_data = load_feeds_yaml(input_path)
    sources = feeds_data.get("sources", [])

    logger.info(f"Enriching {len(sources)} feed sources...")

    # Enrich each source
    enriched_sources = []
    for source in sources:
        try:
            enriched = asyncio.run(enrich_feed_source(source))
            enriched_sources.append(enriched)
            logger.info(f"✓ Enriched: {source.get('id', 'unknown')}")
        except Exception as e:
            logger.error(f"✗ Failed to enrich {source.get('id', 'unknown')}: {e}")
            enriched_sources.append(source)  # Keep original

    # Update document metadata
    from datetime import datetime

    enriched_data = {
        "schema_version": "feeds-enriched-1.0.0",
        "document_meta": {
            **feeds_data.get("document_meta", {}),
            "enriched_at": datetime.utcnow().isoformat(),
            "total_sources": len(enriched_sources),
        },
        "sources": enriched_sources,
    }

    # Save enriched YAML
    save_feeds_yaml(enriched_data, output_path)
    logger.info(f"Saved enriched feeds to {output_path}")

    # Generate and save schema
    schema = generate_enriched_schema()
    save_json_schema(schema, schema_path)
    logger.info(f"Saved enriched schema to {schema_path}")

    # Save to database
    db = DatabaseManager(db_path)
    db.create_db_and_tables()

    for source_data in enriched_sources:
        try:
            # Convert to FeedSource model
            feed_source = FeedSource(
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
            db.add_feed_source(feed_source)
        except Exception as e:
            logger.error(f"Failed to save {source_data.get('id')} to database: {e}")

    logger.info(f"✓ Saved {len(enriched_sources)} sources to database")
    typer.echo(f"✓ Enrichment complete: {len(enriched_sources)} sources processed")


@app.command("one")
def enrich_one(
    feed_id: str = typer.Argument(..., help="Feed ID to enrich"),
    input_path: Path = typer.Option(
        Path("data/feeds.yaml"),
        "--input",
        "-i",
        help="Input feeds YAML file",
    ),
):
    """Enrich a single feed source."""
    feeds_data = load_feeds_yaml(input_path)
    sources = feeds_data.get("sources", [])

    # Find the feed
    feed = next((s for s in sources if s.get("id") == feed_id), None)
    if not feed:
        typer.echo(f"✗ Feed '{feed_id}' not found", err=True)
        raise typer.Exit(1)

    logger.info(f"Enriching feed: {feed_id}")
    enriched = asyncio.run(enrich_feed_source(feed))

    # Pretty print the enriched data
    import yaml

    typer.echo(yaml.dump(enriched, default_flow_style=False, sort_keys=False))

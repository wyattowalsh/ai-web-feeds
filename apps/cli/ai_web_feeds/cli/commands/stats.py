"""ai_web_feeds.cli.commands.stats -- Display statistics about feeds"""

import typer
from loguru import logger

from ai_web_feeds.storage import DatabaseManager

app = typer.Typer(help="Display feed statistics")


@app.command()
def show(
    db_path: str = typer.Option(
        "sqlite:///data/aiwebfeeds.db",
        "--database",
        "-d",
        help="Database URL",
    ),
):
    """Show feed statistics."""
    db = DatabaseManager(db_path)
    feed_sources = db.get_all_feed_sources()
    
    if not feed_sources:
        typer.echo("No feed sources found")
        return
    
    # Basic stats
    total = len(feed_sources)
    verified = sum(1 for f in feed_sources if f.verified)
    
    # By type
    by_type = {}
    for feed in feed_sources:
        if feed.source_type:
            by_type[feed.source_type.value] = by_type.get(feed.source_type.value, 0) + 1
    
    # Display
    typer.echo(f"\n📊 Feed Statistics")
    typer.echo(f"═" * 50)
    typer.echo(f"Total Feeds: {total}")
    typer.echo(f"Verified: {verified} ({verified/total*100:.1f}%)")
    typer.echo(f"\n By Source Type:")
    for source_type, count in sorted(by_type.items(), key=lambda x: -x[1]):
        typer.echo(f"  {source_type:15} : {count:3}")
    typer.echo(f"═" * 50)

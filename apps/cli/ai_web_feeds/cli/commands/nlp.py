"""NLP commands for Phase 5: Advanced AI/NLP Features."""

from typing import Optional

import typer
from loguru import logger
from rich.console import Console
from rich.table import Table

# Import NLP components
from ai_web_feeds.config import Settings
from ai_web_feeds.nlp.jobs.quality_job import QualityBatchJob
from ai_web_feeds.nlp.scheduler import NLPScheduler

app = typer.Typer(help="Advanced AI/NLP features (Phase 5)")
console = Console()


@app.command("quality")
def run_quality_scoring(
    batch_size: Optional[int] = typer.Option(None, "--batch-size", "-b", help="Number of articles to process"),
    force: bool = typer.Option(False, "--force", "-f", help="Reprocess all articles, ignoring existing scores"),
) -> None:
    """Run quality scoring batch job on unprocessed articles.
    
    Examples:
        aiwebfeeds nlp quality
        aiwebfeeds nlp quality --batch-size 50
        aiwebfeeds nlp quality --force
    """
    console.print("[bold blue]Quality Scoring Batch Job[/bold blue]")
    console.print()
    
    try:
        settings = Settings()
        job = QualityBatchJob(settings)
        
        console.print(f"Processing articles (batch_size={batch_size or settings.phase5.quality_batch_size})...")
        stats = job.run(batch_size=batch_size, force=force)
        
        # Display results
        table = Table(title="Quality Scoring Results")
        table.add_column("Metric", style="cyan")
        table.add_column("Count", style="magenta")
        
        table.add_row("Processed", str(stats["processed"]))
        table.add_row("Scored", str(stats["scored"]))
        table.add_row("Skipped", str(stats["skipped"]))
        table.add_row("Failed", str(stats["failed"]))
        table.add_row("Duration", f"{stats['duration_seconds']:.2f}s")
        
        console.print(table)
        
        if stats["failed"] > 0:
            console.print(f"\n[yellow]⚠ {stats['failed']} articles failed to process[/yellow]")
        else:
            console.print("\n[green]✓ Quality scoring completed successfully[/green]")
        
    except Exception as e:
        console.print(f"[red]✗ Quality scoring failed: {e}[/red]")
        logger.error(f"Quality scoring error: {e}")
        raise typer.Exit(code=1)


@app.command("entities")
def run_entity_extraction(
    batch_size: Optional[int] = typer.Option(None, "--batch-size", "-b", help="Number of articles to process"),
    force: bool = typer.Option(False, "--force", "-f", help="Reprocess all articles"),
) -> None:
    """Run entity extraction batch job (Phase 5B - Coming Soon).
    
    Examples:
        aiwebfeeds nlp entities
        aiwebfeeds nlp entities --batch-size 25
    """
    console.print("[yellow]Entity extraction (Phase 5B) - Coming Soon[/yellow]")
    raise typer.Exit(code=0)


@app.command("sentiment")
def run_sentiment_analysis(
    batch_size: Optional[int] = typer.Option(None, "--batch-size", "-b", help="Number of articles to process"),
    force: bool = typer.Option(False, "--force", "-f", help="Reprocess all articles"),
) -> None:
    """Run sentiment analysis batch job (Phase 5C - Coming Soon).
    
    Examples:
        aiwebfeeds nlp sentiment
        aiwebfeeds nlp sentiment --batch-size 50
    """
    console.print("[yellow]Sentiment analysis (Phase 5C) - Coming Soon[/yellow]")
    raise typer.Exit(code=0)


@app.command("topics")
def run_topic_modeling(
    topic: Optional[str] = typer.Option(None, "--topic", "-t", help="Topic to model (default: all)"),
    force: bool = typer.Option(False, "--force", "-f", help="Reprocess all topics"),
) -> None:
    """Run topic modeling batch job (Phase 5D - Coming Soon).
    
    Examples:
        aiwebfeeds nlp topics
        aiwebfeeds nlp topics --topic "Machine Learning"
    """
    console.print("[yellow]Topic modeling (Phase 5D) - Coming Soon[/yellow]")
    raise typer.Exit(code=0)


@app.command("scheduler")
def manage_scheduler(
    action: str = typer.Argument(..., help="Action: start, stop, status"),
) -> None:
    """Manage NLP batch job scheduler.
    
    The scheduler runs all NLP jobs according to configured cron schedules:
    - Quality scoring: every 30 minutes (default)
    - Entity extraction: hourly (default)
    - Sentiment analysis: hourly (default)
    - Topic modeling: monthly (default)
    
    Examples:
        aiwebfeeds nlp scheduler start
        aiwebfeeds nlp scheduler stop
        aiwebfeeds nlp scheduler status
    """
    if action not in ["start", "stop", "status"]:
        console.print(f"[red]Invalid action: {action}. Use: start, stop, status[/red]")
        raise typer.Exit(code=1)
    
    console.print(f"[bold blue]NLP Scheduler: {action}[/bold blue]")
    
    try:
        settings = Settings()
        scheduler = NLPScheduler(settings)
        
        if action == "start":
            scheduler.start()
            console.print("[green]✓ NLP scheduler started[/green]")
            console.print("\nScheduled jobs:")
            console.print(f"  • Quality scoring: {settings.phase5.quality_cron}")
            console.print(f"  • Entity extraction: {settings.phase5.entity_cron}")
            console.print(f"  • Sentiment analysis: {settings.phase5.sentiment_cron}")
            console.print(f"  • Topic modeling: {settings.phase5.topic_modeling_cron}")
        
        elif action == "stop":
            scheduler.shutdown()
            console.print("[green]✓ NLP scheduler stopped[/green]")
        
        elif action == "status":
            if scheduler.scheduler.running:
                console.print("[green]● Running[/green]")
            else:
                console.print("[red]○ Stopped[/red]")
    
    except Exception as e:
        console.print(f"[red]✗ Scheduler {action} failed: {e}[/red]")
        logger.error(f"Scheduler error: {e}")
        raise typer.Exit(code=1)


@app.command("stats")
def show_nlp_stats() -> None:
    """Show NLP processing statistics.
    
    Displays:
    - Articles processed by NLP pipeline
    - Quality score distribution
    - Entity extraction coverage
    - Sentiment analysis coverage
    - Topic modeling status
    
    Examples:
        aiwebfeeds nlp stats
    """
    console.print("[bold blue]NLP Processing Statistics[/bold blue]")
    console.print()
    
    try:
        from sqlmodel import Session, func, select
        from ai_web_feeds.database import get_engine
        from ai_web_feeds.models import ArticleQualityScore, FeedEntry
        
        settings = Settings()
        engine = get_engine(settings)
        
        with Session(engine) as session:
            # Total articles
            total = session.exec(select(func.count(FeedEntry.id))).one()
            
            # Quality scoring stats
            quality_processed = session.exec(
                select(func.count(FeedEntry.id)).where(FeedEntry.quality_processed == True)
            ).one()
            
            avg_quality = session.exec(
                select(func.avg(ArticleQualityScore.overall_score))
            ).one()
            
            # Entity extraction stats
            entities_processed = session.exec(
                select(func.count(FeedEntry.id)).where(FeedEntry.entities_processed == True)
            ).one()
            
            # Sentiment analysis stats
            sentiment_processed = session.exec(
                select(func.count(FeedEntry.id)).where(FeedEntry.sentiment_processed == True)
            ).one()
            
            # Topic modeling stats
            topics_processed = session.exec(
                select(func.count(FeedEntry.id)).where(FeedEntry.topics_processed == True)
            ).one()
        
        # Display results
        table = Table(title="NLP Pipeline Status")
        table.add_column("Component", style="cyan")
        table.add_column("Processed", style="magenta")
        table.add_column("Coverage", style="yellow")
        table.add_column("Avg Score", style="green")
        
        def coverage(processed: int, total: int) -> str:
            if total == 0:
                return "N/A"
            return f"{(processed / total * 100):.1f}%"
        
        table.add_row(
            "Quality Scoring",
            f"{quality_processed}/{total}",
            coverage(quality_processed, total),
            f"{avg_quality:.1f}" if avg_quality else "N/A"
        )
        table.add_row(
            "Entity Extraction",
            f"{entities_processed}/{total}",
            coverage(entities_processed, total),
            "N/A"
        )
        table.add_row(
            "Sentiment Analysis",
            f"{sentiment_processed}/{total}",
            coverage(sentiment_processed, total),
            "N/A"
        )
        table.add_row(
            "Topic Modeling",
            f"{topics_processed}/{total}",
            coverage(topics_processed, total),
            "N/A"
        )
        
        console.print(table)
        
    except Exception as e:
        console.print(f"[red]✗ Failed to fetch NLP stats: {e}[/red]")
        logger.error(f"NLP stats error: {e}")
        raise typer.Exit(code=1)


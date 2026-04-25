"""NLP commands for advanced AI/NLP maintenance workflows."""

from __future__ import annotations

from importlib import import_module
from typing import Optional

import typer
from loguru import logger
from rich.table import Table
from sqlmodel import func, select

from ai_web_feeds.cli.support import ExitCode, console
from ai_web_feeds.config import get_settings, resolve_runtime_database_url
from ai_web_feeds.models import ArticleQualityScore, FeedEntry
from ai_web_feeds.storage import DatabaseManager

app = typer.Typer(help="NLP maintenance and batch job commands", no_args_is_help=True)


def _require_symbol(module_path: str, symbol_name: str):
    """Import a runtime-heavy NLP symbol only when a command executes."""
    try:
        module = import_module(module_path)
        return getattr(module, symbol_name)
    except ImportError as exc:
        console.print(
            "[red]Required NLP dependencies are not available.[/red] "
            f"Unable to import {symbol_name} from {module_path}: {exc}"
        )
        raise typer.Exit(code=int(ExitCode.RUNTIME_ERROR)) from exc


@app.command("quality")
def run_quality_scoring(
    batch_size: Optional[int] = typer.Option(
        None, "--batch-size", "-b", help="Number of articles to process"
    ),
    force: bool = typer.Option(
        False, "--force", "-f", help="Reprocess all articles, ignoring existing scores"
    ),
) -> None:
    """Run quality scoring batch job on unprocessed articles.

    Examples:
        ai-web-feeds nlp quality
        ai-web-feeds nlp quality --batch-size 50
        ai-web-feeds nlp quality --force
    """
    console.print("[bold blue]Quality Scoring Batch Job[/bold blue]")
    console.print()

    try:
        settings = get_settings()
        QualityBatchJob = _require_symbol("ai_web_feeds.nlp.jobs.quality_job", "QualityBatchJob")
        job = QualityBatchJob(settings)

        console.print(
            f"Processing articles (batch_size={batch_size or settings.phase5.quality_batch_size})..."
        )
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
        raise typer.Exit(code=int(ExitCode.RUNTIME_ERROR)) from e


@app.command("entities")
def run_entity_extraction(
    batch_size: Optional[int] = typer.Option(
        None, "--batch-size", "-b", help="Number of articles to process"
    ),
    force: bool = typer.Option(False, "--force", "-f", help="Reprocess all articles"),
) -> None:
    """Run entity extraction batch job using spaCy NER (Phase 5B).

    Examples:
        ai-web-feeds nlp entities
        ai-web-feeds nlp entities --batch-size 25
        ai-web-feeds nlp entities --force
    """
    console.print("[bold blue]Entity Extraction Batch Job[/bold blue]")
    console.print()

    try:
        settings = get_settings()
        EntityBatchJob = _require_symbol("ai_web_feeds.nlp.jobs.entity_job", "EntityBatchJob")
        job = EntityBatchJob(settings)

        console.print(
            f"Processing articles (batch_size={batch_size or settings.phase5.entity_batch_size})..."
        )
        stats = job.run(batch_size=batch_size, force=force)

        # Display results
        table = Table(title="Entity Extraction Results")
        table.add_column("Metric", style="cyan")
        table.add_column("Count", style="magenta")

        table.add_row("Processed", str(stats["processed"]))
        table.add_row("Entities Found", str(stats["entities_found"]))
        table.add_row("Unique Entities", str(stats["unique_entities"]))
        table.add_row("Failed", str(stats["failed"]))
        table.add_row("Duration", f"{stats['duration_seconds']:.2f}s")

        console.print(table)

        if stats["failed"] > 0:
            console.print(f"\n[yellow]⚠ {stats['failed']} articles failed to process[/yellow]")
        else:
            console.print("\n[green]✓ Entity extraction completed successfully[/green]")

    except Exception as e:
        console.print(f"[red]✗ Entity extraction failed: {e}[/red]")
        logger.error(f"Entity extraction error: {e}")
        raise typer.Exit(code=int(ExitCode.RUNTIME_ERROR)) from e


@app.command("sentiment")
def run_sentiment_analysis(
    batch_size: Optional[int] = typer.Option(
        None, "--batch-size", "-b", help="Number of articles to process"
    ),
    force: bool = typer.Option(False, "--force", "-f", help="Reprocess all articles"),
) -> None:
    """Run sentiment analysis batch job using DistilBERT (Phase 5C).

    Examples:
        ai-web-feeds nlp sentiment
        ai-web-feeds nlp sentiment --batch-size 50
        ai-web-feeds nlp sentiment --force
    """
    console.print("[bold blue]Sentiment Analysis Batch Job[/bold blue]")
    console.print()

    try:
        settings = get_settings()
        SentimentBatchJob = _require_symbol(
            "ai_web_feeds.nlp.jobs.sentiment_job", "SentimentBatchJob"
        )
        job = SentimentBatchJob(settings)

        console.print(
            f"Processing articles (batch_size={batch_size or settings.phase5.sentiment_batch_size})..."
        )
        stats = job.run(batch_size=batch_size, force=force)

        # Display results
        table = Table(title="Sentiment Analysis Results")
        table.add_column("Metric", style="cyan")
        table.add_column("Count", style="magenta")

        table.add_row("Processed", str(stats["processed"]))
        table.add_row("Analyzed", str(stats["analyzed"]))
        table.add_row("Positive", f"[green]{stats['positive']}[/green]")
        table.add_row("Neutral", f"[yellow]{stats['neutral']}[/yellow]")
        table.add_row("Negative", f"[red]{stats['negative']}[/red]")
        table.add_row("Failed", str(stats["failed"]))
        table.add_row("Duration", f"{stats['duration_seconds']:.2f}s")

        console.print(table)

        if stats["failed"] > 0:
            console.print(f"\n[yellow]⚠ {stats['failed']} articles failed to process[/yellow]")
        else:
            console.print("\n[green]✓ Sentiment analysis completed successfully[/green]")

    except Exception as e:
        console.print(f"[red]✗ Sentiment analysis failed: {e}[/red]")
        logger.error(f"Sentiment analysis error: {e}")
        raise typer.Exit(code=int(ExitCode.RUNTIME_ERROR)) from e


@app.command("topics")
def run_topic_modeling(
    topic: Optional[str] = typer.Option(
        None, "--topic", "-t", help="Topic to model (default: all)"
    ),
    force: bool = typer.Option(False, "--force", "-f", help="Reprocess all topics"),
    min_articles: int = typer.Option(10, "--min-articles", "-m", help="Minimum articles per topic"),
) -> None:
    """Run topic modeling batch job using Gensim LDA (Phase 5D).

    Discovers subtopics within parent topics and tracks evolution.

    Examples:
        ai-web-feeds nlp topics
        ai-web-feeds nlp topics --topic "Machine Learning"
        ai-web-feeds nlp topics --force --min-articles 20
    """
    console.print("[bold blue]Topic Modeling Batch Job[/bold blue]")
    console.print()

    try:
        settings = get_settings()
        TopicModelingJob = _require_symbol("ai_web_feeds.nlp.jobs.topic_job", "TopicModelingJob")
        job = TopicModelingJob(settings)

        console.print(
            f"Discovering subtopics (topic={topic or 'all'}, min_articles={min_articles})..."
        )
        stats = job.run(topic=topic, force=force, min_articles=min_articles)

        # Display results
        table = Table(title="Topic Modeling Results")
        table.add_column("Metric", style="cyan")
        table.add_column("Count", style="magenta")

        table.add_row("Topics Processed", str(stats["topics_processed"]))
        table.add_row("Subtopics Discovered", str(stats["subtopics_discovered"]))
        table.add_row("Articles Analyzed", str(stats["articles_analyzed"]))
        table.add_row("Failed", str(stats["failed"]))
        table.add_row("Duration", f"{stats['duration_seconds']:.2f}s")

        console.print(table)

        if stats["failed"] > 0:
            console.print(f"\n[yellow]⚠ {stats['failed']} topics failed to process[/yellow]")
        else:
            console.print("\n[green]✓ Topic modeling completed successfully[/green]")
            console.print("\n[dim]Note: Discovered subtopics require manual approval[/dim]")

    except Exception as e:
        console.print(f"[red]✗ Topic modeling failed: {e}[/red]")
        logger.error(f"Topic modeling error: {e}")
        raise typer.Exit(code=int(ExitCode.RUNTIME_ERROR)) from e


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
        ai-web-feeds nlp scheduler start
        ai-web-feeds nlp scheduler stop
        ai-web-feeds nlp scheduler status
    """
    if action not in ["start", "stop", "status"]:
        console.print(f"[red]Invalid action: {action}. Use: start, stop, status[/red]")
        raise typer.Exit(code=int(ExitCode.VALIDATION_ERROR))

    console.print(f"[bold blue]NLP Scheduler: {action}[/bold blue]")

    try:
        settings = get_settings()
        NLPScheduler = _require_symbol("ai_web_feeds.nlp.scheduler", "NLPScheduler")
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
        raise typer.Exit(code=int(ExitCode.RUNTIME_ERROR)) from e


@app.command("stats")
def show_nlp_stats(
    database_url: str | None = typer.Option(
        None,
        "--database",
        "-d",
        help="Database URL (defaults to AIWF_DATABASE_URL)",
    ),
) -> None:
    """Show NLP processing statistics.

    Displays:
    - Articles processed by NLP pipeline
    - Quality score distribution
    - Entity extraction coverage
    - Sentiment analysis coverage
    - Topic modeling status

    Examples:
        ai-web-feeds nlp stats
    """
    console.print("[bold blue]NLP Processing Statistics[/bold blue]")
    console.print()

    try:
        resolved_database_url = resolve_runtime_database_url(database_url)
        db = DatabaseManager(resolved_database_url)
        with db.get_session() as session:
            # Total articles
            total = session.exec(select(func.count(FeedEntry.id))).one()

            # Quality scoring stats
            quality_processed = session.exec(
                select(func.count(FeedEntry.id)).where(FeedEntry.quality_processed.is_(True))
            ).one()

            avg_quality = session.exec(select(func.avg(ArticleQualityScore.overall_score))).one()

            # Entity extraction stats
            entities_processed = session.exec(
                select(func.count(FeedEntry.id)).where(FeedEntry.entities_processed.is_(True))
            ).one()

            # Sentiment analysis stats
            sentiment_processed = session.exec(
                select(func.count(FeedEntry.id)).where(FeedEntry.sentiment_processed.is_(True))
            ).one()

            # Topic modeling stats
            topics_processed = session.exec(
                select(func.count(FeedEntry.id)).where(FeedEntry.topics_processed.is_(True))
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
            f"{avg_quality:.1f}" if avg_quality is not None else "N/A",
        )
        table.add_row(
            "Entity Extraction",
            f"{entities_processed}/{total}",
            coverage(entities_processed, total),
            "N/A",
        )
        table.add_row(
            "Sentiment Analysis",
            f"{sentiment_processed}/{total}",
            coverage(sentiment_processed, total),
            "N/A",
        )
        table.add_row(
            "Topic Modeling",
            f"{topics_processed}/{total}",
            coverage(topics_processed, total),
            "N/A",
        )

        console.print(table)

    except Exception as e:
        console.print(f"[red]✗ Failed to fetch NLP stats: {e}[/red]")
        logger.error(f"NLP stats error: {e}")
        raise typer.Exit(code=int(ExitCode.RUNTIME_ERROR)) from e

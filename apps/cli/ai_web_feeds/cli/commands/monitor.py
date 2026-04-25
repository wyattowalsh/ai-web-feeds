"""Monitor command -- Start/stop real-time feed monitoring"""

from __future__ import annotations

import asyncio

import typer
from ai_web_feeds.config import DEFAULT_DATABASE_URL, Settings
from ai_web_feeds.scheduler import SchedulerManager
from ai_web_feeds.storage import DatabaseManager
from ai_web_feeds.websocket_server import WebSocketServer
from rich.console import Console
from rich.table import Table

app = typer.Typer(help="Real-time feed monitoring commands", no_args_is_help=True)


@app.command("start")
def start_monitoring(
    websocket_port: int | None = typer.Option(
        None,
        "--port",
        "-p",
        help="WebSocket server port (default from config)",
    ),
    database_url: str | None = typer.Option(
        None,
        "--database",
        "-d",
        help="Database URL (defaults to AIWF_DATABASE_URL)",
    ),
    background: bool = typer.Option(
        False,
        "--background",
        "-b",
        help="Run in background (daemonize)",
    ),
) -> None:
    """Start real-time feed monitoring server.

    This starts:
    1. Feed polling scheduler (periodic feed updates)
    2. Trending detection scheduler (hourly topic analysis)
    3. Email digest scheduler (daily/weekly digests)
    4. WebSocket server (real-time notifications)
    """
    console.print("[bold blue]Starting ai-web-feeds Monitoring Server...[/]")

    # Initialize components
    settings = Settings()
    db = DatabaseManager(
        settings.database_url if hasattr(settings, "database_url") else DEFAULT_DATABASE_URL
    )
    db.create_db_and_tables()
    console.print(f"[dim]Database: {resolved_database_url}[/dim]")

    # Override WebSocket port if provided
    if websocket_port:
        settings.phase3b.websocket_port = websocket_port

    # Create scheduler and WebSocket server
    scheduler = SchedulerManager(db, settings)
    websocket_server = WebSocketServer(db, settings)

    if background:
        console.print("[yellow]Background mode not implemented yet. Running in foreground.[/]")

    # Run async event loop
    try:
        asyncio.run(_run_monitoring(scheduler, websocket_server))
    except KeyboardInterrupt:
        console.print("\n[yellow]Received interrupt signal. Shutting down...[/]")
        console.print("[green]✓ Monitoring server stopped[/]")


async def _run_monitoring(scheduler: SchedulerManager, websocket: WebSocketServer) -> None:
    """Run monitoring server with graceful shutdown."""
    # Start scheduler
    scheduler.start()
    console.print("[green]✓ Background scheduler started[/]")

    # Start WebSocket server
    await websocket.start()
    console.print(f"[green]✓ WebSocket server started on port {websocket.port}[/]")

    console.print("\n[bold green]Monitoring server running. Press Ctrl+C to stop.[/]\n")

    # Print job status
    _print_job_status(scheduler)

    # Keep running until interrupted
    try:
        while True:
            await asyncio.sleep(60)  # Wake up every minute
    except asyncio.CancelledError:
        console.print("[yellow]Shutting down monitoring server...[/]")
        scheduler.stop()
        await websocket.stop()


@app.command("stop")
def stop_monitoring() -> None:
    """Stop real-time feed monitoring server."""
    console.print("[yellow]Stop command not implemented yet.[/]")
    console.print("Use Ctrl+C to stop the monitoring server.")
    raise typer.Exit(code=int(ExitCode.NOT_IMPLEMENTED))


@app.command("status")
def monitoring_status():
    """Show monitoring server status."""
    # Initialize components
    settings = Settings()
    db = DatabaseManager(
        settings.database_url if hasattr(settings, "database_url") else DEFAULT_DATABASE_URL
    )
    scheduler = SchedulerManager(db, settings)

    console.print("[bold]Monitoring Server Status[/]\n")
    console.print(f"[dim]Database: {resolved_database_url}[/dim]")
    console.print(
        "[yellow]Configured jobs are shown below. Cross-process runtime detection is not implemented.[/]"
    )
    _print_configured_job_status(settings)
    console.print("\n[yellow]✗ WebSocket: Runtime status check not implemented[/]")


def _print_job_status(scheduler: SchedulerManager) -> None:
    """Print job status table."""
    jobs = scheduler.list_jobs()

    if not jobs:
        console.print("[yellow]No scheduled jobs found[/]")
        return

    table = Table(title="Scheduled Jobs")
    table.add_column("Job ID", style="cyan")
    table.add_column("Name", style="magenta")
    table.add_column("Next Run", style="green")
    table.add_column("Trigger", style="yellow")

    for job in jobs:
        table.add_row(
            job["id"],
            job["name"],
            job["next_run"] or "N/A",
            job["trigger"],
        )

    console.print(table)


def _print_configured_job_status(settings) -> None:
    """Print the configured monitoring jobs without claiming process liveness."""
    table = Table(title="Configured Jobs")
    table.add_column("Job ID", style="cyan")
    table.add_column("Name", style="magenta")
    table.add_column("Trigger", style="yellow")

    table.add_row(
        "poll_feeds",
        "Poll all feeds",
        f"every {settings.phase3b.feed_poll_interval_min} minutes",
    )
    table.add_row(
        "detect_trending",
        "Detect trending topics",
        f"every {settings.phase3b.trending_update_interval_hours} hours",
    )
    table.add_row(
        "send_digests",
        "Send email digests",
        "cron */1 * * * *",
    )
    table.add_row(
        "cleanup_notifications",
        "Cleanup old notifications",
        "cron 0 3 * * *",
    )
    console.print(table)


@app.command("follow")
def follow_feed(
    user_id: str = typer.Argument(..., help="User ID (localStorage UUID)"),
    feed_id: str = typer.Argument(..., help="Feed ID to follow"),
    database_url: str | None = typer.Option(
        None,
        "--database",
        "-d",
        help="Database URL (defaults to AIWF_DATABASE_URL)",
    ),
) -> None:
    """Follow a feed to receive notifications."""
    settings = Settings()
    db = DatabaseManager(
        settings.database_url if hasattr(settings, "database_url") else DEFAULT_DATABASE_URL
    )

    try:
        follow = db.follow_feed(user_id, feed_id)
        console.print(f"[green]✓ Now following feed: {feed_id}[/]")
        console.print(f"User: {user_id}")
        console.print(f"Followed at: {follow.followed_at}")
    except Exception as e:
        console.print(f"[red]✗ Failed to follow feed: {e}[/]")
        raise typer.Exit(code=int(ExitCode.RUNTIME_ERROR)) from e


@app.command("unfollow")
def unfollow_feed(
    user_id: str = typer.Argument(..., help="User ID (localStorage UUID)"),
    feed_id: str = typer.Argument(..., help="Feed ID to unfollow"),
    database_url: str | None = typer.Option(
        None,
        "--database",
        "-d",
        help="Database URL (defaults to AIWF_DATABASE_URL)",
    ),
) -> None:
    """Unfollow a feed to stop receiving notifications."""
    settings = Settings()
    db = DatabaseManager(
        settings.database_url if hasattr(settings, "database_url") else DEFAULT_DATABASE_URL
    )

    try:
        db.unfollow_feed(user_id, feed_id)
        console.print(f"[green]✓ Unfollowed feed: {feed_id}[/]")
    except Exception as e:
        console.print(f"[red]✗ Failed to unfollow feed: {e}[/]")
        raise typer.Exit(code=int(ExitCode.RUNTIME_ERROR)) from e


@app.command("list-follows")
def list_follows(
    user_id: str = typer.Argument(..., help="User ID (localStorage UUID)"),
    database_url: str | None = typer.Option(
        None,
        "--database",
        "-d",
        help="Database URL (defaults to AIWF_DATABASE_URL)",
    ),
) -> None:
    """List feeds followed by a user."""
    settings = Settings()
    db = DatabaseManager(
        settings.database_url if hasattr(settings, "database_url") else DEFAULT_DATABASE_URL
    )

    try:
        follows = db.get_user_follows(user_id)

        if not follows:
            console.print("[yellow]No followed feeds found[/]")
            return

        console.print(f"\n[bold]Followed Feeds ({len(follows)})[/]\n")
        for feed_id in follows:
            console.print(f"  • {feed_id}")

    except Exception as e:
        console.print(f"[red]✗ Failed to list follows: {e}[/]")
        raise typer.Exit(code=int(ExitCode.RUNTIME_ERROR)) from e


@app.command("subscribe-digest")
def subscribe_digest(
    user_id: str = typer.Argument(..., help="User ID (localStorage UUID)"),
    email: str = typer.Argument(..., help="Email address"),
    database_url: str | None = typer.Option(
        None,
        "--database",
        "-d",
        help="Database URL (defaults to AIWF_DATABASE_URL)",
    ),
    schedule: str = typer.Option("daily", help="Digest schedule (daily/weekly)"),
    timezone: str = typer.Option("UTC", help="Timezone (e.g., 'America/New_York')"),
) -> None:
    """Subscribe to email digests."""
    from datetime import datetime, timedelta

    from ai_web_feeds.models import EmailDigest

    settings = Settings()
    db = DatabaseManager(
        settings.database_url if hasattr(settings, "database_url") else DEFAULT_DATABASE_URL
    )
    from ai_web_feeds.models import EmailDigest

    db = DatabaseManager(resolve_runtime_database_url(database_url))

    # Map schedule to cron expression
    cron_map = DEFAULT_DIGEST_CRONS

    if schedule not in cron_map:
        console.print(f"[red]✗ Invalid schedule. Choose from: {', '.join(cron_map.keys())}[/]")
        raise typer.Exit(code=int(ExitCode.VALIDATION_ERROR))

    try:
        normalized_timezone = validate_timezone_name(timezone)
        digest = EmailDigest(
            user_id=user_id,
            email=email,
            schedule_type=schedule,
            schedule_cron=cron_map[schedule],
            timezone=normalized_timezone,
            next_send_at=calculate_next_send_at(
                schedule_type=schedule,
                schedule_cron=cron_map[schedule],
                timezone_name=normalized_timezone,
                from_time=datetime.now(UTC),
            ),
        )

        created = db.create_email_digest(digest)
        console.print(f"[green]✓ Subscribed to {schedule} digest[/]")
        console.print(f"Email: {email}")
        console.print(f"Schedule: {schedule} ({cron_map[schedule]})")
        console.print(f"Timezone: {timezone}")
        console.print(f"Next send: {created.next_send_at}")

    except ValueError as e:
        console.print(f"[red]✗ Invalid digest configuration: {e}[/]")
        raise typer.Exit(code=int(ExitCode.VALIDATION_ERROR)) from e
    except Exception as e:
        console.print(f"[red]✗ Failed to subscribe: {e}[/]")
        raise typer.Exit(code=int(ExitCode.RUNTIME_ERROR)) from e


@app.command("unsubscribe-digest")
def unsubscribe_digest(
    digest_id: int = typer.Argument(..., help="Digest subscription ID"),
    database_url: str | None = typer.Option(
        None,
        "--database",
        "-d",
        help="Database URL (defaults to AIWF_DATABASE_URL)",
    ),
) -> None:
    """Unsubscribe from email digests."""
    from datetime import UTC, datetime

    settings = Settings()
    db = DatabaseManager(
        settings.database_url if hasattr(settings, "database_url") else DEFAULT_DATABASE_URL
    )

    try:
        # Mark as unsubscribed
        digest.unsubscribed_at = datetime.now(UTC)
        db.update_email_digest(digest)

        console.print(f"[green]✓ Unsubscribed from digest {digest_id}[/]")

    except Exception as e:
        console.print(f"[red]✗ Failed to unsubscribe: {e}[/]")
        raise typer.Exit(code=int(ExitCode.RUNTIME_ERROR)) from e


@app.command("list-digests")
def list_digests(
    user_id: str = typer.Argument(..., help="User ID (localStorage UUID)"),
    database_url: str | None = typer.Option(
        None,
        "--database",
        "-d",
        help="Database URL (defaults to AIWF_DATABASE_URL)",
    ),
) -> None:
    """List email digest subscriptions for a user."""
    settings = Settings()
    db = DatabaseManager(
        settings.database_url if hasattr(settings, "database_url") else DEFAULT_DATABASE_URL
    )

    try:
        digests = db.get_user_digests(user_id)

        if not digests:
            console.print("[yellow]No digest subscriptions found[/]")
            return

        console.print(f"\n[bold]Email Digest Subscriptions ({len(digests)})[/]\n")

        table = Table()
        table.add_column("ID", style="cyan")
        table.add_column("Email", style="green")
        table.add_column("Schedule", style="yellow")
        table.add_column("Status", style="magenta")
        table.add_column("Next Send", style="blue")

        for digest in digests:
            status = "[green]Active[/]" if digest.unsubscribed_at is None else "[red]Inactive[/]"
            next_send = (
                digest.next_send_at.strftime("%Y-%m-%d %H:%M") if digest.next_send_at else "N/A"
            )

            table.add_row(
                str(digest.id),
                digest.email,
                digest.schedule_type,
                status,
                next_send,
            )

        console.print(table)

    except Exception as e:
        console.print(f"[red]✗ Failed to list digests: {e}[/]")
        raise typer.Exit(code=int(ExitCode.RUNTIME_ERROR)) from e

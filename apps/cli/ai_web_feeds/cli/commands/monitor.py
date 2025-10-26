"""Monitor command -- Start/stop real-time feed monitoring"""

import asyncio
import signal
import sys
from pathlib import Path

import typer
from loguru import logger
from rich.console import Console
from rich.table import Table

from ai_web_feeds.config import Settings
from ai_web_feeds.scheduler import SchedulerManager
from ai_web_feeds.storage import DatabaseManager
from ai_web_feeds.websocket_server import WebSocketServer

app     = typer.Typer(help="Real-time feed monitoring commands")
console = Console()


@app.command("start")
def start_monitoring(
    websocket_port: int = typer.Option(
        None,
        "--port",
        "-p",
        help="WebSocket server port (default from config)",
    ),
    background: bool = typer.Option(
        False,
        "--background",
        "-b",
        help="Run in background (daemonize)",
    ),
):
    """Start real-time feed monitoring server.

    This starts:
    1. Feed polling scheduler (periodic feed updates)
    2. Trending detection scheduler (hourly topic analysis)
    3. Email digest scheduler (daily/weekly digests)
    4. WebSocket server (real-time notifications)
    """
    console.print("[bold blue]Starting AI Web Feeds Monitoring Server...[/]")

    # Initialize components
    settings = Settings()
    db       = DatabaseManager(settings.database_url if hasattr(settings, 'database_url') else "sqlite:///data/aiwebfeeds.db")
    db.create_db_and_tables()

    # Override WebSocket port if provided
    if websocket_port:
        settings.phase3b.websocket_port = websocket_port

    # Create scheduler and WebSocket server
    scheduler       = SchedulerManager(db, settings)
    websocket_server= WebSocketServer(db, settings)

    if background:
        console.print("[yellow]Background mode not implemented yet. Running in foreground.[/]")

    # Run async event loop
    try:
        asyncio.run(_run_monitoring(scheduler, websocket_server))
    except KeyboardInterrupt:
        console.print("\n[yellow]Received interrupt signal. Shutting down...[/]")
        scheduler.stop()
        console.print("[green]✓ Monitoring server stopped[/]")


async def _run_monitoring(scheduler: SchedulerManager, websocket: WebSocketServer):
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


@app.command("stop")
def stop_monitoring():
    """Stop real-time feed monitoring server."""
    console.print("[yellow]Stop command not implemented yet.[/]")
    console.print("Use Ctrl+C to stop the monitoring server.")
    raise typer.Exit(1)


@app.command("status")
def monitoring_status():
    """Show monitoring server status."""
    # Initialize components
    settings  = Settings()
    db        = DatabaseManager(settings.database_url if hasattr(settings, 'database_url') else "sqlite:///data/aiwebfeeds.db")
    scheduler = SchedulerManager(db, settings)

    console.print("[bold]Monitoring Server Status[/]\n")

    # Check if scheduler is running
    if scheduler.scheduler.running:
        console.print("[green]✓ Scheduler: Running[/]")
        _print_job_status(scheduler)
    else:
        console.print("[red]✗ Scheduler: Stopped[/]")

    # WebSocket server status (TODO: implement proper status check)
    console.print("\n[yellow]✗ WebSocket: Status check not implemented[/]")


def _print_job_status(scheduler: SchedulerManager):
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


@app.command("follow")
def follow_feed(
    user_id: str = typer.Argument(..., help="User ID (localStorage UUID)"),
    feed_id: str = typer.Argument(..., help="Feed ID to follow"),
):
    """Follow a feed to receive notifications."""
    settings = Settings()
    db       = DatabaseManager(settings.database_url if hasattr(settings, 'database_url') else "sqlite:///data/aiwebfeeds.db")

    try:
        follow = db.follow_feed(user_id, feed_id)
        console.print(f"[green]✓ Now following feed: {feed_id}[/]")
        console.print(f"User: {user_id}")
        console.print(f"Followed at: {follow.followed_at}")
    except Exception as e:
        console.print(f"[red]✗ Failed to follow feed: {e}[/]")
        raise typer.Exit(1)


@app.command("unfollow")
def unfollow_feed(
    user_id: str = typer.Argument(..., help="User ID (localStorage UUID)"),
    feed_id: str = typer.Argument(..., help="Feed ID to unfollow"),
):
    """Unfollow a feed to stop receiving notifications."""
    settings = Settings()
    db       = DatabaseManager(settings.database_url if hasattr(settings, 'database_url') else "sqlite:///data/aiwebfeeds.db")

    try:
        db.unfollow_feed(user_id, feed_id)
        console.print(f"[green]✓ Unfollowed feed: {feed_id}[/]")
    except Exception as e:
        console.print(f"[red]✗ Failed to unfollow feed: {e}[/]")
        raise typer.Exit(1)


@app.command("list-follows")
def list_follows(
    user_id: str = typer.Argument(..., help="User ID (localStorage UUID)"),
):
    """List feeds followed by a user."""
    settings = Settings()
    db       = DatabaseManager(settings.database_url if hasattr(settings, 'database_url') else "sqlite:///data/aiwebfeeds.db")

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
        raise typer.Exit(1)


"""ai_web_feeds.cli.commands.topics -- Topic taxonomy commands"""

from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table

from ai_web_feeds import load_topics

app = typer.Typer(help="Manage and inspect the topic taxonomy")
console = Console()


def _get_topics_path(topics_file: Optional[Path]) -> Path:
    """Resolve topics.yaml path, falling back to workspace data directory."""
    if topics_file is not None:
        return topics_file

    # Try to locate data/topics.yaml relative to this file
    current = Path(__file__).resolve()
    for parent in current.parents:
        candidate = parent / "data" / "topics.yaml"
        if candidate.exists():
            return candidate

    # Fallback to conventional workspace-relative path
    return Path("data/topics.yaml")


@app.command("list")
def topics_list(
    topics_file: Optional[Path] = typer.Option(
        None,
        "--file",
        "-f",
        help="Path to topics.yaml file",
    ),
    facet: Optional[str] = typer.Option(
        None,
        "--facet",
        help="Filter by facet (e.g., domain, task, subfield)",
    ),
    group: Optional[str] = typer.Option(
        None,
        "--group",
        help="Filter by facet group (e.g., conceptual, governance)",
    ),
    limit: int = typer.Option(
        0,
        "--limit",
        "-n",
        help="Limit number of results (0 = all)",
    ),
) -> None:
    """List topics from the taxonomy."""
    path = _get_topics_path(topics_file)

    if not path.exists():
        console.print(f"[red]Error: {path} not found[/red]")
        raise typer.Exit(1)

    console.print(f"📚 Loading topics from {path}")

    data = load_topics(path)
    topics = data.get("topics", [])

    if not topics:
        console.print("[yellow]No topics found[/yellow]")
        return

    # Apply filters
    filtered = topics
    if facet:
        filtered = [t for t in filtered if t.get("facet") == facet]
    if group:
        filtered = [t for t in filtered if t.get("facet_group") == group]

    total = len(filtered)
    display = filtered[:limit] if limit > 0 else filtered

    console.print(f"\n[bold]Topics ({len(display)}/{total})[/bold]\n")

    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("ID", style="cyan")
    table.add_column("Label", style="white")
    table.add_column("Facet", style="green")
    table.add_column("Group", style="blue")
    table.add_column("Parents", style="dim")

    for topic in display:
        parents = ", ".join(topic.get("parents", [])) if topic.get("parents") else "-"
        table.add_row(
            topic.get("id", ""),
            topic.get("label", ""),
            topic.get("facet", "") or "-",
            topic.get("facet_group", "") or "-",
            parents,
        )

    console.print(table)

    # Summary
    facets: dict[str, int] = {}
    groups: dict[str, int] = {}
    for t in filtered:
        f = t.get("facet") or "(none)"
        g = t.get("facet_group") or "(none)"
        facets[f] = facets.get(f, 0) + 1
        groups[g] = groups.get(g, 0) + 1

    console.print("\n[bold]By Facet:[/bold]")
    for f, count in sorted(facets.items(), key=lambda x: -x[1]):
        console.print(f"  {f}: {count}")

    console.print("\n[bold]By Group:[/bold]")
    for g, count in sorted(groups.items(), key=lambda x: -x[1]):
        console.print(f"  {g}: {count}")


@app.command("show")
def topics_show(
    topic_id: str = typer.Argument(..., help="Topic ID to display"),
    topics_file: Optional[Path] = typer.Option(
        None,
        "--file",
        "-f",
        help="Path to topics.yaml file",
    ),
) -> None:
    """Show details for a specific topic."""
    path = _get_topics_path(topics_file)

    if not path.exists():
        console.print(f"[red]Error: {path} not found[/red]")
        raise typer.Exit(1)

    data = load_topics(path)
    topics = data.get("topics", [])

    topic = next((t for t in topics if t.get("id") == topic_id), None)

    if not topic:
        console.print(f"[red]Topic '{topic_id}' not found[/red]")
        # Suggest similar
        similar = [t["id"] for t in topics if topic_id.lower() in t.get("id", "").lower()][:5]
        if similar:
            console.print(f"[dim]Did you mean: {', '.join(similar)}?[/dim]")
        raise typer.Exit(1)

    console.print(f"\n[bold cyan]{topic.get('label', topic_id)}[/bold cyan] ({topic_id})\n")

    if topic.get("description"):
        console.print(f"[bold]Description:[/bold] {topic['description']}\n")

    if topic.get("facet"):
        console.print(f"[bold]Facet:[/bold] {topic['facet']}")
    if topic.get("facet_group"):
        console.print(f"[bold]Group:[/bold] {topic['facet_group']}")

    parents = topic.get("parents", [])
    if parents:
        console.print(f"[bold]Parents:[/bold] {', '.join(parents)}")

    aliases = topic.get("aliases", [])
    if aliases:
        console.print(f"[bold]Aliases:[/bold] {', '.join(aliases)}")

    relations = topic.get("relations", {})
    if relations:
        console.print("\n[bold]Relations:[/bold]")
        for rel_type, targets in relations.items():
            if isinstance(targets, list) and targets:
                console.print(f"  {rel_type}: {', '.join(targets)}")

    tags = topic.get("tags", [])
    if tags:
        console.print(f"\n[bold]Tags:[/bold] {', '.join(tags)}")

    console.print()

"""Visualization commands for the repository topic taxonomy."""

from __future__ import annotations

from collections import Counter
import json
from pathlib import Path
from typing import Any, Literal

import typer
from rich.json import JSON
from rich.panel import Panel
from rich.table import Table

from ai_web_feeds.cli.support import ExitCode, console
from ai_web_feeds.config import default_data_path
from ai_web_feeds.load import load_topics

app = typer.Typer(help="Visualize the topic taxonomy", no_args_is_help=True)


def _load_topic_records(input_path: Path) -> list[dict[str, Any]]:
    """Load topic records from a topics YAML document."""
    document = load_topics(input_path)
    records = document.get("topics", [])
    if not isinstance(records, list):
        msg = f"{input_path} must define a top-level 'topics' list"
        raise ValueError(msg)

    topics = [topic for topic in records if isinstance(topic, dict) and topic.get("id")]
    if not topics:
        msg = f"No topic records were found in {input_path}"
        raise ValueError(msg)
    return topics


def _sanitize_mermaid_id(topic_id: str) -> str:
    return topic_id.replace("-", "_").replace(".", "_")


def _escape_mermaid_label(label: str) -> str:
    return label.replace('"', '\\"')


def _depth_for_topic(
    topic_id: str,
    index: dict[str, dict[str, Any]],
    cache: dict[str, int],
    trail: set[str] | None = None,
) -> int:
    """Compute the maximum parent depth for a topic."""
    if topic_id in cache:
        return cache[topic_id]

    parents = [
        parent
        for parent in index.get(topic_id, {}).get("parents", [])
        if isinstance(parent, str) and parent in index
    ]
    if not parents:
        cache[topic_id] = 0
        return 0

    trail = trail or set()
    if topic_id in trail:
        cache[topic_id] = 0
        return 0

    depth = 1 + max(
        _depth_for_topic(parent, index, cache, trail | {topic_id}) for parent in parents
    )
    cache[topic_id] = depth
    return depth


def _topic_graph(
    input_path: Path,
    *,
    facets: set[str] | None = None,
    max_depth: int | None = None,
    include_relations: bool = True,
) -> tuple[list[dict[str, Any]], list[dict[str, str]], dict[str, int]]:
    """Build node/link payloads for the selected topic graph."""
    topics = _load_topic_records(input_path)
    index = {str(topic["id"]): topic for topic in topics}
    depths: dict[str, int] = {}
    for topic_id in index:
        _depth_for_topic(topic_id, index, depths)

    selected_topics = [
        topic
        for topic in topics
        if (not facets or topic.get("facet") in facets)
        and (max_depth is None or depths.get(str(topic["id"]), 0) <= max_depth)
    ]
    selected_ids = {str(topic["id"]) for topic in selected_topics}

    links: list[dict[str, str]] = []
    for topic in selected_topics:
        topic_id = str(topic["id"])
        for parent in topic.get("parents", []):
            if isinstance(parent, str) and parent in selected_ids:
                links.append({"source": parent, "target": topic_id, "relation": "parent"})

        if not include_relations:
            continue

        relations = topic.get("relations", {})
        if not isinstance(relations, dict):
            continue
        for relation, targets in relations.items():
            if not isinstance(targets, list):
                continue
            for target in targets:
                if isinstance(target, str) and target in selected_ids:
                    links.append(
                        {
                            "source": topic_id,
                            "target": target,
                            "relation": str(relation),
                        }
                    )

    nodes = [
        {
            "id": str(topic["id"]),
            "label": str(topic.get("label", topic["id"])),
            "facet": topic.get("facet"),
            "facet_group": topic.get("facet_group"),
            "depth": depths.get(str(topic["id"]), 0),
            "parents": [parent for parent in topic.get("parents", []) if parent in index],
        }
        for topic in selected_topics
    ]
    return nodes, links, depths


def _stats_for_graph(nodes: list[dict[str, Any]]) -> dict[str, Any]:
    """Calculate graph summary statistics."""
    facet_counts = Counter(
        str(node["facet"]) for node in nodes if node.get("facet") not in (None, "")
    )
    facet_group_counts = Counter(
        str(node["facet_group"]) for node in nodes if node.get("facet_group") not in (None, "")
    )
    depths = [int(node["depth"]) for node in nodes]
    root_topics = sum(1 for node in nodes if not node.get("parents"))
    avg_depth = round(sum(depths) / len(depths), 2) if depths else 0.0

    return {
        "total_topics": len(nodes),
        "root_topics": root_topics,
        "max_depth": max(depths, default=0),
        "avg_depth": avg_depth,
        "facets": dict(sorted(facet_counts.items())),
        "facet_groups": dict(sorted(facet_group_counts.items())),
    }


@app.command(name="mermaid")
def visualize_mermaid(
    input_path: Path = typer.Option(
        default_data_path("topics.yaml"),
        "--input",
        "-i",
        help="Input topics YAML file",
    ),
    output: Path = typer.Option(
        Path("taxonomy.mermaid"),
        "-o",
        "--output",
        help="Output file path for Mermaid diagram",
    ),
    direction: Literal["TD", "LR", "BT", "RL"] = typer.Option(
        "TD",
        "-d",
        "--direction",
        help="Graph direction (TD=top-down, LR=left-right, etc.)",
    ),
    max_depth: int | None = typer.Option(
        None,
        "--max-depth",
        help="Maximum depth from root nodes (defaults to all depths)",
    ),
    include_relations: bool = typer.Option(
        True,
        "--relations/--no-relations",
        help="Include non-parent topic relations",
    ),
    facets: str | None = typer.Option(
        None,
        "--facets",
        help="Comma-separated list of facets to include",
    ),
    show_preview: bool = typer.Option(
        True,
        "--preview/--no-preview",
        help="Show a preview of the generated diagram",
    ),
) -> None:
    """Generate a Mermaid diagram for the topic taxonomy."""
    selected_facets = {facet.strip() for facet in facets.split(",")} if facets else None

    try:
        nodes, links, _ = _topic_graph(
            input_path,
            facets=selected_facets,
            max_depth=max_depth,
            include_relations=include_relations,
        )
    except Exception as exc:
        console.print(f"[red]Error:[/red] {exc}")
        raise typer.Exit(code=int(ExitCode.RUNTIME_ERROR)) from exc

    lines = [f"graph {direction}"]
    for node in nodes:
        lines.append(
            f'    {_sanitize_mermaid_id(node["id"])}["{_escape_mermaid_label(str(node["label"]))}"]'
        )
    for link in links:
        source = _sanitize_mermaid_id(link["source"])
        target = _sanitize_mermaid_id(link["target"])
        if link["relation"] == "parent":
            lines.append(f"    {source} --> {target}")
        else:
            lines.append(f"    {source} -. {link['relation']} .-> {target}")

    mermaid_code = "\n".join(lines) + "\n"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(mermaid_code, encoding="utf-8")

    console.print(f"[green]✓[/green] Mermaid diagram saved to [cyan]{output}[/cyan]")
    console.print(f"[dim]Loaded {len(nodes)} topics from {input_path}[/dim]")

    if show_preview:
        preview_lines = mermaid_code.splitlines()[:20]
        preview_text = "\n".join(preview_lines)
        if len(mermaid_code.splitlines()) > 20:
            preview_text += "\n... (truncated)"
        console.print(
            Panel(
                preview_text,
                title="[bold]Mermaid Diagram Preview[/bold]",
                border_style="blue",
            )
        )


@app.command(name="json")
def visualize_json(
    input_path: Path = typer.Option(
        default_data_path("topics.yaml"),
        "--input",
        "-i",
        help="Input topics YAML file",
    ),
    output: Path = typer.Option(
        Path("taxonomy.json"),
        "-o",
        "--output",
        help="Output file path for JSON graph",
    ),
    include_relations: bool = typer.Option(
        True,
        "--relations/--no-relations",
        help="Include non-parent topic relations",
    ),
    show_preview: bool = typer.Option(
        True,
        "--preview/--no-preview",
        help="Show a preview of the generated JSON",
    ),
) -> None:
    """Generate a JSON graph export for the topic taxonomy."""
    try:
        nodes, links, _ = _topic_graph(
            input_path,
            include_relations=include_relations,
        )
    except Exception as exc:
        console.print(f"[red]Error:[/red] {exc}")
        raise typer.Exit(code=int(ExitCode.RUNTIME_ERROR)) from exc

    graph = {"nodes": nodes, "links": links}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(graph, indent=2), encoding="utf-8")

    console.print(f"[green]✓[/green] JSON graph saved to [cyan]{output}[/cyan]")
    console.print(f"  Nodes: {len(nodes)} | Links: {len(links)}")

    if show_preview:
        preview_data = {
            "nodes": nodes[:3],
            "links": links[:3],
            "...": f"{max(len(nodes) - 3, 0)} more nodes, {max(len(links) - 3, 0)} more links",
        }
        console.print(
            Panel(
                JSON.from_data(preview_data),
                title="[bold]JSON Graph Preview[/bold]",
                border_style="blue",
            )
        )


@app.command(name="stats")
def visualize_stats(
    input_path: Path = typer.Option(
        default_data_path("topics.yaml"),
        "--input",
        "-i",
        help="Input topics YAML file",
    ),
    include_relations: bool = typer.Option(
        True,
        "--relations/--no-relations",
        help="Include non-parent topic relations when counting graph links",
    ),
) -> None:
    """Show summary statistics for the topic taxonomy."""
    try:
        nodes, links, _ = _topic_graph(input_path, include_relations=include_relations)
        stats = _stats_for_graph(nodes)
    except Exception as exc:
        console.print(f"[red]Error:[/red] {exc}")
        raise typer.Exit(code=int(ExitCode.RUNTIME_ERROR)) from exc

    console.print("\n[bold cyan]Taxonomy Statistics[/bold cyan]\n")

    summary_table = Table(show_header=False, box=None)
    summary_table.add_column("Metric", style="bold")
    summary_table.add_column("Value", style="green")
    summary_table.add_row("Total Topics", str(stats["total_topics"]))
    summary_table.add_row("Root Topics", str(stats["root_topics"]))
    summary_table.add_row("Maximum Depth", str(stats["max_depth"]))
    summary_table.add_row("Average Depth", f"{stats['avg_depth']:.2f}")
    summary_table.add_row("Graph Links", str(len(links)))
    console.print(summary_table)

    console.print("\n[bold cyan]Facets[/bold cyan]\n")
    facets_table = Table()
    facets_table.add_column("Facet", style="cyan")
    facets_table.add_column("Count", justify="right", style="green")
    for facet, count in stats["facets"].items():
        facets_table.add_row(facet, str(count))
    console.print(facets_table)

    console.print("\n[bold cyan]Facet Groups[/bold cyan]\n")
    groups_table = Table()
    groups_table.add_column("Facet Group", style="cyan")
    groups_table.add_column("Count", justify="right", style="green")
    for group, count in stats["facet_groups"].items():
        groups_table.add_row(group, str(count))
    console.print(groups_table)

"""Visualize command for taxonomy visualization."""

from __future__ import annotations

from pathlib import Path
from typing import Literal

import typer
from rich.console import Console
from rich.json import JSON
from rich.panel import Panel
from rich.table import Table

app = typer.Typer(help="Visualize the taxonomy/ontology graph")
console = Console()


@app.command(name="mermaid")
def visualize_mermaid(
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
        help="Maximum depth from root nodes (None = unlimited)",
    ),
    include_relations: bool = typer.Option(
        True,
        "--relations/--no-relations",
        help="Include non-parent relations",
    ),
    facets: str | None = typer.Option(
        None,
        "--facets",
        help="Comma-separated list of facets to include",
    ),
    show_preview: bool = typer.Option(
        True,
        "--preview/--no-preview",
        help="Show preview of generated diagram",
    ),
) -> None:
    """Generate a Mermaid diagram visualization of the taxonomy."""
    try:
        from ai_web_feeds.taxonomy import TaxonomyVisualizer, load_taxonomy

        # Load taxonomy
        with console.status("Loading taxonomy..."):
            taxonomy = load_taxonomy()

        console.print(
            f"[green]✓[/green] Loaded {len(taxonomy.topics)} topics",
            style="bold",
        )

        # Prepare options
        filter_facets = facets.split(",") if facets else None

        # Generate visualization
        with console.status("Generating Mermaid diagram..."):
            visualizer = TaxonomyVisualizer(taxonomy)
            mermaid_code = visualizer.to_mermaid(
                direction=direction,
                include_relations=include_relations,
                max_depth=max_depth,
                filter_facets=filter_facets,
            )

        # Save to file
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(mermaid_code)

        console.print(f"[green]✓[/green] Mermaid diagram saved to [cyan]{output}[/cyan]")

        # Show preview if requested
        if show_preview:
            preview_lines = mermaid_code.split("\n")[:20]
            preview_text = "\n".join(preview_lines)
            if len(mermaid_code.split("\n")) > 20:
                preview_text += "\n... (truncated)"

            console.print(
                Panel(
                    preview_text,
                    title="[bold]Mermaid Diagram Preview[/bold]",
                    border_style="blue",
                )
            )

    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        raise typer.Exit(code=1) from e


@app.command(name="json")
def visualize_json(
    output: Path = typer.Option(
        Path("taxonomy.json"),
        "-o",
        "--output",
        help="Output file path for JSON graph",
    ),
    show_preview: bool = typer.Option(
        True,
        "--preview/--no-preview",
        help="Show preview of generated JSON",
    ),
) -> None:
    """Generate a JSON graph visualization of the taxonomy."""
    try:
        from ai_web_feeds.taxonomy import TaxonomyVisualizer, load_taxonomy

        # Load taxonomy
        with console.status("Loading taxonomy..."):
            taxonomy = load_taxonomy()

        console.print(
            f"[green]✓[/green] Loaded {len(taxonomy.topics)} topics",
            style="bold",
        )

        # Generate visualization
        with console.status("Generating JSON graph..."):
            visualizer = TaxonomyVisualizer(taxonomy)
            graph = visualizer.to_json_graph()

        # Save to file
        import json

        output.parent.mkdir(parents=True, exist_ok=True)
        with output.open("w", encoding="utf-8") as f:
            json.dump(graph, f, indent=2)

        console.print(f"[green]✓[/green] JSON graph saved to [cyan]{output}[/cyan]")
        console.print(
            f"  Nodes: {len(graph['nodes'])} | Links: {len(graph['links'])}",
            style="dim",
        )

        # Show preview if requested
        if show_preview:
            sample_nodes = graph["nodes"][:3]
            sample_links = graph["links"][:3]
            preview_data = {
                "nodes": sample_nodes,
                "links": sample_links,
                "...": f"{len(graph['nodes']) - 3} more nodes, {len(graph['links']) - 3} more links",
            }

            console.print(
                Panel(
                    JSON.from_data(preview_data),
                    title="[bold]JSON Graph Preview[/bold]",
                    border_style="blue",
                )
            )

    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        raise typer.Exit(code=1) from e


@app.command(name="stats")
def visualize_stats() -> None:
    """Show statistics about the taxonomy."""
    try:
        from ai_web_feeds.taxonomy import TaxonomyVisualizer, load_taxonomy

        # Load taxonomy
        with console.status("Loading taxonomy..."):
            taxonomy = load_taxonomy()
            visualizer = TaxonomyVisualizer(taxonomy)
            stats = visualizer.get_statistics()

        # Display general statistics
        console.print("\n[bold cyan]Taxonomy Statistics[/bold cyan]\n")

        general_table = Table(show_header=False, box=None)
        general_table.add_column("Metric", style="bold")
        general_table.add_column("Value", style="green")

        general_table.add_row("Total Topics", str(stats["total_topics"]))
        general_table.add_row("Root Topics", str(stats["root_topics"]))
        general_table.add_row("Maximum Depth", str(stats["max_depth"]))
        general_table.add_row("Average Depth", f"{stats['avg_depth']:.2f}")

        console.print(general_table)

        # Display facet statistics
        console.print("\n[bold cyan]Facets[/bold cyan]\n")

        facets_table = Table()
        facets_table.add_column("Facet", style="cyan")
        facets_table.add_column("Count", justify="right", style="green")

        for facet, count in sorted(
            stats["facets"].items(),
            key=lambda x: x[1],
            reverse=True,
        ):
            facets_table.add_row(facet, str(count))

        console.print(facets_table)

        # Display facet group statistics
        console.print("\n[bold cyan]Facet Groups[/bold cyan]\n")

        groups_table = Table()
        groups_table.add_column("Facet Group", style="cyan")
        groups_table.add_column("Count", justify="right", style="green")

        for group, count in sorted(
            stats["facet_groups"].items(),
            key=lambda x: x[1],
            reverse=True,
        ):
            groups_table.add_row(group, str(count))

        console.print(groups_table)
        console.print()

    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        raise typer.Exit(code=1) from e


if __name__ == "__main__":
    app()

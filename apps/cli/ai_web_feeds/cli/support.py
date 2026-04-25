"""Shared support helpers for the ai-web-feeds CLI."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import IntEnum, StrEnum
import json
from typing import Any, Mapping

import typer
from rich import box
from rich.console import Console
from rich.table import Table

console = Console()


class ExitCode(IntEnum):
    """Stable process exit codes for CLI commands."""

    OK = 0
    RUNTIME_ERROR = 1
    VALIDATION_ERROR = 2
    NOT_IMPLEMENTED = 3


class ResultFormat(StrEnum):
    """Supported summary output formats."""

    TEXT = "text"
    JSON = "json"


class StatsFormat(StrEnum):
    """Supported statistics output formats."""

    TABLE = "table"
    JSON = "json"


@dataclass(slots=True)
class CommandResult:
    """Structured CLI summary payload."""

    status: str
    summary: str
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serialisable representation."""
        return {
            "status": self.status,
            "summary": self.summary,
            "details": self.details,
        }


def normalize_feed_document(data: Mapping[str, Any] | None) -> dict[str, Any]:
    """Return a canonical feed document using the ``sources`` key."""
    normalized = dict(data or {})
    if "sources" not in normalized and isinstance(normalized.get("feeds"), list):
        normalized["sources"] = normalized["feeds"]
    return normalized


def get_sources(data: Mapping[str, Any] | None) -> list[dict[str, Any]]:
    """Extract canonical feed sources from either ``sources`` or legacy ``feeds`` keys."""
    sources = normalize_feed_document(data).get("sources", [])
    return list(sources) if isinstance(sources, list) else []


def render_result(
    result: CommandResult,
    *,
    format: ResultFormat = ResultFormat.TEXT,
    title: str | None = None,
) -> None:
    """Render a structured CLI result."""
    if format == ResultFormat.JSON:
        console.print(json.dumps(result.to_dict(), indent=2, sort_keys=True, default=str))
        return

    if title:
        console.print(f"[bold]{title}[/bold]")

    color = {
        "success": "green",
        "warning": "yellow",
        "error": "red",
    }.get(result.status, "white")
    console.print(f"[{color}]{result.summary}[/{color}]")

    if not result.details:
        return

    table = Table(box=box.SIMPLE_HEAVY, show_header=True, header_style="bold cyan")
    table.add_column("Field")
    table.add_column("Value")
    for key, value in result.details.items():
        if isinstance(value, (dict, list, tuple)):
            rendered = json.dumps(value, ensure_ascii=False, default=str)
        else:
            rendered = str(value)
        table.add_row(key.replace("_", " "), rendered)
    console.print(table)


def fail(
    message: str,
    *,
    code: ExitCode = ExitCode.RUNTIME_ERROR,
    details: dict[str, Any] | None = None,
) -> None:
    """Render an error and exit."""
    render_result(CommandResult(status="error", summary=message, details=details or {}))
    raise typer.Exit(code=int(code))

"""Helpers for loading ai-web-feeds CLI command modules."""

from __future__ import annotations

from importlib import import_module
from types import ModuleType

CORE_COMMAND_MODULES = (
    "fetch",
    "load",
    "validate",
    "enrich",
    "export",
    "opml",
    "stats",
    "test",
    "analytics",
    "search",
    "recommend",
    "monitor",
)
OPTIONAL_COMMAND_MODULES = (
    "visualize",
    "nlp",
)


def load_command_module(module_name: str) -> ModuleType:
    """Import a CLI command module by name."""
    return import_module(f"{__name__}.{module_name}")


def load_optional_command_module(module_name: str) -> ModuleType | None:
    """Import an optional CLI command module when available."""
    try:
        return load_command_module(module_name)
    except ImportError:
        return None


__all__ = [
    "CORE_COMMAND_MODULES",
    "OPTIONAL_COMMAND_MODULES",
    "load_command_module",
    "load_optional_command_module",
]

"""Helpers for loading ai-web-feeds CLI command modules."""

from ai_web_feeds.cli.commands import corpus, enrich, export, opml, stats, test, validate

from importlib import import_module
from types import ModuleType

__all__ = ["corpus", "enrich", "export", "nlp", "opml", "stats", "test", "validate"]

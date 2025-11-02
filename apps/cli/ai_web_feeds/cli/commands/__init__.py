"""ai_web_feeds.cli.commands -- CLI command modules"""

from ai_web_feeds.cli.commands import enrich, export, opml, stats, test, validate

# Lazy import for NLP to avoid heavy dependencies at startup
nlp = None

__all__ = ["enrich", "export", "nlp", "opml", "stats", "test", "validate"]

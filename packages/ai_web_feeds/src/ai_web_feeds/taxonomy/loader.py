"""Load taxonomy from topics.yaml."""

from __future__ import annotations

from pathlib import Path

from ai_web_feeds.load import load_topics
from ai_web_feeds.taxonomy.models import Taxonomy, Topic
from ai_web_feeds.taxonomy.paths import resolve_topics_path


def load_taxonomy(path: Path | str | None = None) -> Taxonomy:
    """Load and index the topic taxonomy graph."""
    topics_path = resolve_topics_path(Path(path) if path is not None else None)
    document = load_topics(topics_path)
    entries = document.get("topics", [])
    if not isinstance(entries, list):
        msg = f"topics.yaml must contain a list at 'topics': {topics_path}"
        raise TypeError(msg)

    topics = [Topic.from_entry(entry) for entry in entries if isinstance(entry, dict)]
    return Taxonomy(topics)

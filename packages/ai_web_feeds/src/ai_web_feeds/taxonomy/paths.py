"""Path resolution for taxonomy data files."""

from __future__ import annotations

from pathlib import Path


def resolve_topics_path(path: Path | None = None) -> Path:
    """Resolve topics.yaml, mirroring CLI topics command walk-up logic."""
    if path is not None:
        return path

    current = Path(__file__).resolve()
    for parent in current.parents:
        candidate = parent / "data" / "topics.yaml"
        if candidate.exists():
            return candidate

    return Path("data/topics.yaml")

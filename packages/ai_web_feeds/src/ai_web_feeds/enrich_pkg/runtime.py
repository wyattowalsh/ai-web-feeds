"""ai_web_feeds.enrich_pkg.runtime -- Call-time lookup of enrich facade names."""

from typing import Any


def lookup(name: str) -> Any:
    """Return ``name`` from ``ai_web_feeds.enrich`` at call time.

    Tests and callers patch that module. Implementation modules must not bind
    those names themselves, or the patch would miss the object that runs.
    """
    from ai_web_feeds import enrich

    return getattr(enrich, name)

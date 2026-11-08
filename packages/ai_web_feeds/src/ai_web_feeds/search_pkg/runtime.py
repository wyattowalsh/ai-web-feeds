"""Call-time lookup of names on the search facade.

Callers and tests patch ``ai_web_feeds.search``. Implementations resolve
``text``, ``generate_query_embedding``, ``get_trie_index``, and sibling
helpers there so those patches still apply.
"""

from typing import Any

from ai_web_feeds.config import Settings


def lookup(name: str) -> Any:
    """Return the current ``ai_web_feeds.search`` binding for ``name``."""
    from ai_web_feeds import search

    return getattr(search, name)


def get_settings() -> Settings:
    """Get or create shared settings instance."""
    from ai_web_feeds import search

    if search._settings is None:
        search._settings = search.Settings()
    return search._settings

"""Search implementation modules.

Import the public API from ``ai_web_feeds.search``. This package is the
implementation behind that facade.
"""

from ai_web_feeds.search_pkg.autocomplete import autocomplete
from ai_web_feeds.search_pkg.fts import create_fts_table, full_text_search
from ai_web_feeds.search_pkg.history import (
    delete_saved_search,
    get_saved_searches,
    log_search_query,
    save_search,
)
from ai_web_feeds.search_pkg.runtime import get_settings
from ai_web_feeds.search_pkg.semantic import (
    generate_query_embedding,
    hybrid_search,
    semantic_search,
)
from ai_web_feeds.search_pkg.trie import TrieIndex, TrieNode, build_trie_index, get_trie_index

__all__ = [
    "TrieIndex",
    "TrieNode",
    "autocomplete",
    "build_trie_index",
    "create_fts_table",
    "delete_saved_search",
    "full_text_search",
    "generate_query_embedding",
    "get_saved_searches",
    "get_settings",
    "get_trie_index",
    "hybrid_search",
    "log_search_query",
    "save_search",
    "semantic_search",
]

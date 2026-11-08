"""ai_web_feeds.search -- Search and discovery functionality.

This module provides search functions including:
- Full-text search with SQLite FTS5
- Semantic similarity search with embeddings
- Autocomplete with Trie index
- Faceted filtering
- Search history tracking
- Saved search management

Uses SQLite FTS5 for full-text search and NumPy for vector similarity.
Implementations live in :mod:`ai_web_feeds.search_pkg`.
"""

from typing import Any

import numpy as np
from loguru import logger
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlmodel import Session, select

from ai_web_feeds.config import Settings
from ai_web_feeds.models import FeedEmbedding, FeedSource, SavedSearch, SearchQuery
from ai_web_feeds.search_pkg import (
    TrieIndex,
    TrieNode,
    autocomplete,
    build_trie_index,
    create_fts_table,
    delete_saved_search,
    full_text_search,
    generate_query_embedding,
    get_saved_searches,
    get_settings,
    get_trie_index,
    hybrid_search,
    log_search_query,
    save_search,
    semantic_search,
)

# These bindings are the patch surface. Implementation looks them up by name.
_settings: Settings | None = None
_trie_index: TrieIndex | None = None

__all__ = [
    "Any",
    "FeedEmbedding",
    "FeedSource",
    "OperationalError",
    "SavedSearch",
    "SearchQuery",
    "Session",
    "Settings",
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
    "logger",
    "np",
    "save_search",
    "select",
    "semantic_search",
    "text",
]

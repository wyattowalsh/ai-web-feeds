"""Trie index for autocomplete suggestions."""

from loguru import logger
from sqlmodel import Session, select

from ai_web_feeds.models import FeedSource
from ai_web_feeds.search_pkg.runtime import lookup


class TrieNode:
    """Trie node for autocomplete suggestions."""

    def __init__(self) -> None:
        self.children: dict[str, TrieNode] = {}
        self.is_end_of_word = False
        self.feed_ids: list[str] = []
        self.frequency: int = 0


class TrieIndex:
    """Trie index for fast autocomplete suggestions."""

    def __init__(self) -> None:
        self.root = TrieNode()

    def insert(self, word: str, feed_id: str) -> None:
        """Insert word into Trie with associated feed ID."""
        node = self.root
        word_lower = word.lower()

        for char in word_lower:
            if char not in node.children:
                node.children[char] = TrieNode()
            node = node.children[char]

        node.is_end_of_word = True
        if feed_id not in node.feed_ids:
            node.feed_ids.append(feed_id)
        node.frequency += 1

    def search_prefix(self, prefix: str, limit: int = 8) -> list[tuple[str, list[str], int]]:
        """Search for words with given prefix.

        Args:
            prefix: Search prefix
            limit: Maximum number of suggestions

        Returns:
            List of (word, feed_ids, frequency) tuples
        """
        node = self.root
        prefix_lower = prefix.lower()

        # Traverse to prefix node
        for char in prefix_lower:
            if char not in node.children:
                return []
            node = node.children[char]

        # Collect all words with this prefix
        results: list[tuple[str, list[str], int]] = []
        self._collect_words(node, prefix_lower, results)

        # Sort by frequency and return top results
        results.sort(key=lambda item: item[2], reverse=True)
        return results[:limit]

    def _collect_words(
        self,
        node: TrieNode,
        current_word: str,
        results: list[tuple[str, list[str], int]],
    ) -> None:
        """Recursively collect all words from node."""
        if node.is_end_of_word:
            results.append((current_word, node.feed_ids, node.frequency))

        for char, child_node in node.children.items():
            self._collect_words(child_node, current_word + char, results)


def build_trie_index(session: Session) -> TrieIndex:
    """Build Trie index from feed titles and topics.

    Args:
        session: Database session

    Returns:
        Populated TrieIndex
    """
    from ai_web_feeds import search

    logger.info("Building Trie index for autocomplete")

    trie = TrieIndex()

    # Get all feeds
    feeds = session.exec(select(FeedSource)).all()

    for feed in feeds:
        # Index feed title words
        if feed.title:
            words = feed.title.lower().split()
            for word in words:
                if len(word) >= 2:  # Only index words >= 2 chars
                    trie.insert(word, feed.id)

        # Index topics
        for topic in feed.topics:
            trie.insert(topic, feed.id)

    search._trie_index = trie
    logger.info(f"Trie index built with {len(feeds)} feeds")
    return trie


def get_trie_index(session: Session) -> TrieIndex:
    """Get cached Trie index or build if not exists."""
    from ai_web_feeds import search

    cached: TrieIndex | None = search._trie_index
    if cached is not None:
        return cached
    built: TrieIndex = lookup("build_trie_index")(session)
    search._trie_index = built
    return built

"""Unit tests for the visualization cache layer."""

from ai_web_feeds.visualization.cache import CacheLayer


class TestCacheKeyGeneration:
    """Test cache key generation."""

    def test_generate_cache_key_basic(self):
        """Cache keys should use the versioned query prefix."""
        cache = CacheLayer(enable_redis=False)

        key = cache._generate_cache_key(
            "test_endpoint",
            {"device_id": "test-123"},
            {"start": "2024-01-01", "end": "2024-01-31"},
            "test-device",
        )

        assert key.startswith(f"{cache.CACHE_VERSION}:query:")
        assert len(key) > 40

    def test_generate_cache_key_deterministic(self):
        """The same inputs should always produce the same key."""
        cache = CacheLayer(enable_redis=False)
        filters = {"a": 1, "b": 2}
        date_range = {"start": "2024-01-01", "end": "2024-01-31"}

        key1 = cache._generate_cache_key("test", filters, date_range, "device-1")
        key2 = cache._generate_cache_key("test", filters, date_range, "device-1")

        assert key1 == key2

    def test_generate_cache_key_param_order_independent(self):
        """Dictionary ordering should not affect the generated hash."""
        cache = CacheLayer(enable_redis=False)
        date_range = {"start": "2024-01-01", "end": "2024-01-31"}

        key1 = cache._generate_cache_key("test", {"a": 1, "b": 2}, date_range, "device-1")
        key2 = cache._generate_cache_key("test", {"b": 2, "a": 1}, date_range, "device-1")

        assert key1 == key2

    def test_generate_query_cache_key_normalizes_legacy_aliases(self):
        """Real query cache keys should normalize equivalent alias payloads."""
        key1 = generate_query_cache_key(
            "topic_metrics",
            {"topic_ids": [2, 1], "date_range": {"start": "2024-01-01", "end": "2024-01-31"}},
            {"start": "2024-01-01", "end": "2024-01-31"},
            "device-123",
        )
        key2 = generate_query_cache_key(
            "topic_metrics",
            {"topicIds": [1, 2], "dateRange": {"startDate": "2024-01-01", "endDate": "2024-01-31"}},
            {"startDate": "2024-01-01", "endDate": "2024-01-31"},
            "device-123",
        )

        assert key1 == key2
        assert key1.startswith("v1:query:topic_metrics:")


class TestCacheLayerLRU:
    """Test CacheLayer behavior with the in-memory fallback."""

    def test_lru_fallback_round_trip(self):
        """Stored data should be retrievable when Redis is disabled."""
        cache = CacheLayer(enable_redis=False)
        filters = {"topic": "llm"}
        date_range = {"start": "2024-01-01", "end": "2024-01-31"}
        payload = {"items": [1, 2, 3]}

        cache.set("topic_metrics", filters, date_range, "device-1", payload)
        result = cache.get("topic_metrics", filters, date_range, "device-1")

        assert result == payload

    def test_lru_cache_miss_returns_none(self):
        """Missing keys should return None."""
        cache = CacheLayer(enable_redis=False)

        result = cache.get(
            "topic_metrics",
            {"topic": "missing"},
            {"start": "2024-01-01", "end": "2024-01-31"},
            "device-1",
        )

        assert result is None

    def test_invalidate_clears_lru_entries(self):
        """Invalidation should clear in-memory cached data."""
        cache = CacheLayer(enable_redis=False)
        filters = {"topic": "llm"}
        date_range = {"start": "2024-01-01", "end": "2024-01-31"}

        cache.set("topic_metrics", filters, date_range, "device-1", {"value": 42})
        cache.invalidate()

        result = cache.get("topic_metrics", filters, date_range, "device-1")
        assert result is None

    def test_lru_respects_max_size(self):
        """The fallback cache should evict the oldest entry when full."""
        cache = CacheLayer(enable_redis=False)
        cache.LRU_MAX_SIZE = 2

        base_range = {"start": "2024-01-01", "end": "2024-01-31"}
        cache.set("topic_metrics", {"topic": "a"}, base_range, "device-1", {"value": "a"})
        cache.set("topic_metrics", {"topic": "b"}, base_range, "device-1", {"value": "b"})
        cache.set("topic_metrics", {"topic": "c"}, base_range, "device-1", {"value": "c"})

        assert cache.get("topic_metrics", {"topic": "a"}, base_range, "device-1") is None
        assert cache.get("topic_metrics", {"topic": "b"}, base_range, "device-1") == {"value": "b"}
        assert cache.get("topic_metrics", {"topic": "c"}, base_range, "device-1") == {"value": "c"}

    def test_cache_stats_track_hits_and_misses(self):
        """Cache statistics should reflect fallback usage."""
        cache = CacheLayer(enable_redis=False)
        filters = {"topic": "llm"}
        date_range = {"start": "2024-01-01", "end": "2024-01-31"}

        cache.get("topic_metrics", filters, date_range, "device-1")
        cache.set("topic_metrics", filters, date_range, "device-1", {"value": 1})
        cache.get("topic_metrics", filters, date_range, "device-1")

        stats = cache.get_stats()
        assert stats["cache_type"] == "lru"
        assert stats["hits"] == 1
        assert stats["misses"] == 1
        assert stats["total_requests"] == 2

"""
Unit tests for visualization cache layer.

Tests caching functionality with Redis fallback to LRU.
"""

from collections import OrderedDict
from unittest.mock import MagicMock, Mock, patch

import pytest
from ai_web_feeds.visualization.cache import (
    DEFAULT_TTL,
    TOPIC_GRAPH_TTL,
    CacheLayer,
    CacheService,
    generate_cache_key,
    generate_query_cache_key,
)


class TestCacheKeyGeneration:
    """Test cache key generation."""

    def test_generate_cache_key_basic(self):
        """Test basic cache key generation."""
        params = {"device_id": "test-123", "date": "2024-01-01"}
        key = generate_cache_key("test_endpoint", params)

        assert key.startswith("aiwebfeeds:cache:test_endpoint:")
        assert len(key) > 40  # SHA-256 hash length

    def test_generate_cache_key_deterministic(self):
        """Test cache keys are deterministic."""
        params = {"a": 1, "b": 2}
        key1 = generate_cache_key("test", params)
        key2 = generate_cache_key("test", params)

        assert key1 == key2

    def test_generate_cache_key_different_params(self):
        """Test different params produce different keys."""
        key1 = generate_cache_key("test", {"a": 1})
        key2 = generate_cache_key("test", {"a": 2})

        assert key1 != key2

    def test_generate_cache_key_param_order_independent(self):
        """Test param order doesn't affect key."""
        params1 = {"a": 1, "b": 2, "c": 3}
        params2 = {"c": 3, "a": 1, "b": 2}

        key1 = generate_cache_key("test", params1)
        key2 = generate_cache_key("test", params2)

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


class TestCacheServiceRedis:
    """Test CacheService with Redis backend."""

    @pytest.fixture
    def mock_redis(self):
        """Create a mock Redis client."""
        mock = MagicMock()
        mock.get.return_value = None
        mock.set.return_value = True
        mock.delete.return_value = 1
        return mock

    @pytest.fixture
    def cache_service(self, mock_redis):
        """Create CacheService with mocked Redis."""
        with patch("ai_web_feeds.visualization.cache.redis.Redis", return_value=mock_redis):
            service = CacheService(redis_url="redis://localhost:6379")
            service.redis = mock_redis
            return service

    def test_get_cache_miss(self, cache_service, mock_redis):
        """Test cache miss returns None."""
        mock_redis.get.return_value = None

        result = cache_service.get("test_key")

        assert result is None
        mock_redis.get.assert_called_once()

    def test_get_cache_hit(self, cache_service, mock_redis):
        """Test cache hit returns value."""
        import json

        cached_data = {"value": 42}
        mock_redis.get.return_value = json.dumps(cached_data).encode()

        result = cache_service.get("test_key")

        assert result == cached_data
        mock_redis.get.assert_called_once()

    def test_set_cache(self, cache_service, mock_redis):
        """Test setting cache value."""
        data = {"test": "data"}

        cache_service.set("test_key", data, ttl=300)

        mock_redis.set.assert_called_once()
        args = mock_redis.set.call_args
        assert args[0][0] == "test_key"
        assert args[1]["ex"] == 300

    def test_delete_cache(self, cache_service, mock_redis):
        """Test deleting cache key."""
        cache_service.delete("test_key")

        mock_redis.delete.assert_called_once_with("test_key")

    def test_invalidate_pattern(self, cache_service, mock_redis):
        """Test invalidating keys by pattern."""
        mock_redis.scan_iter.return_value = [
            b"key1",
            b"key2",
            b"key3",
        ]

        cache_service.invalidate_pattern("test:*")

        mock_redis.scan_iter.assert_called_once_with(match="test:*")
        assert mock_redis.delete.call_count == 3


class TestCacheServiceLRU:
    """Test CacheService with LRU fallback."""

    @pytest.fixture
    def cache_service_lru(self):
        """Create CacheService with LRU fallback (no Redis)."""
        with patch("ai_web_feeds.visualization.cache.redis.Redis") as mock_redis_cls:
            mock_redis_cls.side_effect = Exception("Redis unavailable")
            service = CacheService(redis_url="redis://localhost:6379")
            return service

    def test_lru_fallback_get_miss(self, cache_service_lru):
        """Test LRU cache miss."""
        result = cache_service_lru.get("test_key")

        assert result is None

    def test_lru_fallback_get_hit(self, cache_service_lru):
        """Test LRU cache hit."""
        data = {"value": 123}

        cache_service_lru.set("test_key", data)
        result = cache_service_lru.get("test_key")

        assert result == data

    def test_lru_fallback_delete(self, cache_service_lru):
        """Test LRU cache deletion."""
        cache_service_lru.set("test_key", {"data": "value"})
        cache_service_lru.delete("test_key")

        result = cache_service_lru.get("test_key")
        assert result is None

    def test_lru_fallback_max_size(self, cache_service_lru):
        """Test LRU cache respects max size."""
        # Set max_size to 5 for testing
        cache_service_lru._lru_cache = OrderedDict()
        cache_service_lru._lru_max_size = 5

        # Add 10 items
        for i in range(10):
            cache_service_lru.set(f"key_{i}", {"value": i})

        assert len(cache_service_lru._lru_cache) == 5
        assert "key_0" not in cache_service_lru._lru_cache
        assert "key_5" in cache_service_lru._lru_cache


class TestCacheServiceErrors:
    """Test error handling in CacheService."""

    @pytest.fixture
    def cache_service_with_errors(self):
        """Create CacheService that simulates Redis errors."""
        mock_redis = MagicMock()
        mock_redis.get.side_effect = Exception("Redis connection error")
        mock_redis.set.side_effect = Exception("Redis connection error")

        with patch("ai_web_feeds.visualization.cache.redis.Redis", return_value=mock_redis):
            service = CacheService(redis_url="redis://localhost:6379")
            service.redis = mock_redis
            return service

    def test_get_redis_error_fallback(self, cache_service_with_errors):
        """Test graceful fallback on Redis error during get."""
        # Should fall back to LRU cache
        result = cache_service_with_errors.get("test_key")

        # Should return None (LRU cache miss)
        assert result is None

    def test_set_redis_error_fallback(self, cache_service_with_errors):
        """Test graceful fallback on Redis error during set."""
        # Should fall back to LRU cache
        cache_service_with_errors.set("test_key", {"data": "value"})

        # Should be retrievable from LRU
        result = cache_service_with_errors.get("test_key")
        assert result == {"data": "value"}


class TestCacheTTL:
    """Test cache TTL (time-to-live) functionality."""

    def test_default_ttl(self):
        """Test default TTL is 300 seconds."""
        assert DEFAULT_TTL == 300
        assert TOPIC_GRAPH_TTL == DEFAULT_TTL

    @patch("ai_web_feeds.visualization.cache.redis.Redis")
    def test_custom_ttl(self, mock_redis_cls):
        """Test setting custom TTL."""
        mock_redis = MagicMock()
        mock_redis_cls.return_value = mock_redis

        service = CacheService(redis_url="redis://localhost:6379")
        service.redis = mock_redis

        service.set("test_key", {"data": "value"}, ttl=600)

        args = mock_redis.set.call_args
        assert args[1]["ex"] == 600


class TestCacheIntegration:
    """Integration tests for cache service."""

    @pytest.mark.integration
    def test_cache_workflow(self):
        """Test complete cache workflow."""
        # This would require a real Redis instance
        # Skip in unit tests
        pytest.skip("Integration test - requires Redis")


class TestCacheLayer:
    """Regression tests for the versioned CacheLayer used by data services."""

    def test_cache_layer_lru_expiry(self, monkeypatch):
        """LRU fallback should expire entries based on the provided TTL."""
        now = {"value": 1000.0}
        monkeypatch.setattr("ai_web_feeds.visualization.cache.time", lambda: now["value"])

        cache = CacheLayer(enable_redis=False)
        filters = {"topicIds": [1, 2]}
        date_range = {"startDate": "2024-01-01", "endDate": "2024-01-31"}

        cache.set("topic_metrics", filters, date_range, "device-123", {"rows": 2}, ttl=10)
        assert cache.get("topic_metrics", filters, date_range, "device-123") == {"rows": 2}

        now["value"] = 1011.0
        assert cache.get("topic_metrics", filters, date_range, "device-123") is None

    def test_cache_layer_invalidate_query_type(self):
        """Invalidation should remove only matching query-type keys."""
        cache = CacheLayer(enable_redis=False)
        date_range = {"start": "2024-01-01", "end": "2024-01-31"}

        cache.set("topic_metrics", {"topic_ids": [1]}, date_range, "device-123", {"rows": 1})
        cache.set("feed_health", {"feed_ids": ["feed-1"]}, date_range, "device-123", {"rows": 1})

        invalidated = cache.invalidate(query_type="topic_metrics")

        assert invalidated == 1
        assert cache.get("topic_metrics", {"topic_ids": [1]}, date_range, "device-123") is None
        assert cache.get("feed_health", {"feed_ids": ["feed-1"]}, date_range, "device-123") == {
            "rows": 1
        }

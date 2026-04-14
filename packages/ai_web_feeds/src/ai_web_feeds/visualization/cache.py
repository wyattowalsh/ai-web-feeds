"""Cache layer for visualization data with Redis and LRU fallback.

Implements FR-011a through FR-011c:
- Cache invalidation rules with 5-minute TTL
- Cache key generation using SHA-256 hashing
- Cache failure handling with Redis → LRU fallback
"""

import hashlib
import json
from typing import Any, cast
from urllib.parse import urlparse

from loguru import logger

from ai_web_feeds.config import settings

try:
    import redis
    from redis.exceptions import ConnectionError as RedisConnectionError
    from redis.exceptions import RedisError

    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logger.warning("redis-py not installed, using LRU cache fallback")


class CacheLayer:
    """Cache layer with Redis (production) or LRU (development) fallback.

    Provides:
    - 5-minute TTL for analytics queries
    - Consistent cache key generation (SHA-256)
    - Automatic fallback to in-memory cache on Redis failure
    - Cache versioning for schema changes
    """

    CACHE_VERSION = "v1"
    DEFAULT_TTL = 300  # 5 minutes in seconds
    LRU_MAX_SIZE = 100  # Maximum in-memory cache entries

    def __init__(
        self,
        redis_url: str | None = None,
        enable_redis: bool = True,
    ) -> None:
        """Initialize cache layer.

        Args:
            redis_url: Redis connection URL (e.g., redis://localhost:6379/0)
            enable_redis: Whether to attempt Redis connection
        """
        self.redis_client: redis.Redis[Any] | None = None
        self.redis_enabled = False

        # Try to connect to Redis if available and enabled
        if REDIS_AVAILABLE and enable_redis and redis_url:
            try:
                self.redis_client = redis.from_url(
                    redis_url,
                    decode_responses=True,
                    socket_connect_timeout=2,
                )
                # Test connection
                self.redis_client.ping()
                self.redis_enabled = True
                logger.info("Redis cache initialized successfully")
            except (RedisConnectionError, RedisError) as e:
                logger.warning(f"Failed to connect to Redis: {e}")
                logger.info("Falling back to LRU cache")
                self.redis_client = None
        else:
            logger.info("Using LRU cache (Redis not configured)")

        # Initialize in-memory cache statistics
        self._cache_hits = 0
        self._cache_misses = 0

    def _generate_cache_key(
        self,
        query_type: str,
        filters: dict[str, Any],
        date_range: dict[str, str],
        device_id: str,
    ) -> str:
        """Generate consistent cache key using SHA-256 hash.

        Format: {version}:query:{hash}

        Args:
            query_type: Type of query (e.g., "topic_metrics", "feed_health")
            filters: Query filters (topics, feeds, etc.)
            date_range: Date range (start, end)
            device_id: User device identifier

        Returns:
            Versioned cache key string
        """
        # Create deterministic string from parameters
        key_data = {
            "query_type": query_type,
            "filters": filters,
            "date_range": date_range,
            "device_id": device_id,
        }

        # Sort keys for consistency
        json_str = json.dumps(key_data, sort_keys=True)

        # Generate SHA-256 hash
        hash_digest = hashlib.sha256(json_str.encode()).hexdigest()

        return f"{self.CACHE_VERSION}:query:{hash_digest}"

    def get(
        self,
        query_type: str,
        filters: dict[str, Any],
        date_range: dict[str, str],
        device_id: str,
    ) -> Any | None:
        """Retrieve cached data.

        Args:
            query_type: Type of query
            filters: Query filters
            date_range: Date range
            device_id: Device identifier

        Returns:
            Cached data or None if not found
        """
        cache_key = self._generate_cache_key(
            query_type,
            filters,
            date_range,
            device_id,
        )

        # Try Redis first
        if self.redis_enabled and self.redis_client:
            try:
                cached_data = self.redis_client.get(cache_key)
                if cached_data:
                    self._cache_hits += 1
                    logger.debug(f"Cache hit (Redis): {cache_key[:16]}...")
                    return json.loads(cast(str | bytes | bytearray, cached_data))
            except RedisError as e:
                logger.warning(f"Redis get error: {e}, falling back to LRU")
                # Don't disable Redis, just skip this operation

        # Fallback to LRU cache
        cached_data = self._lru_get(cache_key)
        if cached_data is not None:
            self._cache_hits += 1
            logger.debug(f"Cache hit (LRU): {cache_key[:16]}...")
            return cached_data

        self._cache_misses += 1
        logger.debug(f"Cache miss: {cache_key[:16]}...")
        return None

    def set(  # noqa: PLR0913
        self,
        query_type: str,
        filters: dict[str, Any],
        date_range: dict[str, str],
        device_id: str,
        data: Any,
        ttl: int = DEFAULT_TTL,
    ) -> bool:
        """Store data in cache with TTL.

        Args:
            query_type: Type of query
            filters: Query filters
            date_range: Date range
            device_id: Device identifier
            data: Data to cache
            ttl: Time-to-live in seconds

        Returns:
            True if cached successfully, False otherwise
        """
        cache_key = self._generate_cache_key(
            query_type,
            filters,
            date_range,
            device_id,
        )

        # Try Redis first
        if self.redis_enabled and self.redis_client:
            try:
                self.redis_client.setex(
                    cache_key,
                    ttl,
                    json.dumps(data),
                )
                logger.debug(f"Cached to Redis: {cache_key[:16]}... (TTL: {ttl}s)")
                return True
            except RedisError as e:
                logger.warning(f"Redis set error: {e}, falling back to LRU")

        # Fallback to LRU cache
        self._lru_set(cache_key, data)
        logger.debug(f"Cached to LRU: {cache_key[:16]}...")
        return True

    def invalidate(
        self,
        query_type: str | None = None,
        pattern: str | None = None,
    ) -> int:
        """Invalidate cached entries.

        Args:
            query_type: Specific query type to invalidate (optional)
            pattern: Redis key pattern to match (optional)

        Returns:
            Number of keys invalidated
        """
        count = 0

        if self.redis_enabled and self.redis_client:
            try:
                if pattern:
                    # Pattern-based invalidation
                    keys = self.redis_client.keys(f"{self.CACHE_VERSION}:{pattern}")
                elif query_type:
                    # Type-specific invalidation (requires scanning)
                    keys = self.redis_client.keys(f"{self.CACHE_VERSION}:query:*")
                else:
                    # Invalidate all queries
                    keys = self.redis_client.keys(f"{self.CACHE_VERSION}:query:*")

                if keys:
                    redis_keys = list(cast(list[str], keys))
                    count = self.redis_client.delete(*redis_keys)
                    logger.info(f"Invalidated {count} cache entries from Redis")
            except RedisError as e:
                logger.error(f"Redis invalidation error: {e}")

        # Clear LRU cache (no partial clearing available)
        self._lru_clear()
        logger.info("Cleared LRU cache")

        return count

    def get_stats(self) -> dict[str, Any]:
        """Get cache statistics.

        Returns:
            Dictionary with cache metrics
        """
        total_requests = self._cache_hits + self._cache_misses
        hit_rate = (self._cache_hits / total_requests * 100) if total_requests > 0 else 0.0

        stats = {
            "cache_type": "redis" if self.redis_enabled else "lru",
            "hits": self._cache_hits,
            "misses": self._cache_misses,
            "hit_rate": round(hit_rate, 2),
            "total_requests": total_requests,
        }

        # Add Redis-specific stats if available
        if self.redis_enabled and self.redis_client:
            try:
                info = cast(dict[str, Any], self.redis_client.info("stats"))
                stats["redis_connected_clients"] = info.get("connected_clients", 0)
                stats["redis_total_commands"] = info.get("total_commands_processed", 0)
            except RedisError:
                pass

        return stats

    # LRU cache methods (fallback implementation)

    def _lru_get(self, key: str) -> Any | None:
        """Get an item from the in-memory fallback cache."""
        if not hasattr(self, "_lru_storage"):
            self._lru_storage: dict[str, Any] = {}
        return self._lru_storage.get(key)

    def _lru_set(self, key: str, data: Any) -> None:
        """Store data in LRU cache."""
        if not hasattr(self, "_lru_storage"):
            self._lru_storage = {}
        self._lru_storage[key] = data

        # Enforce size limit
        if len(self._lru_storage) > self.LRU_MAX_SIZE:
            # Remove oldest entry (simplified LRU)
            oldest_key = next(iter(self._lru_storage))
            del self._lru_storage[oldest_key]

    def _lru_clear(self) -> None:
        """Clear LRU cache."""
        if hasattr(self, "_lru_storage"):
            self._lru_storage.clear()


# Global cache state (initialized by config)
_cache_state: dict[str, CacheLayer | None] = {"instance": None}


def get_cache() -> CacheLayer:
    """Get global cache instance.

    Returns:
        CacheLayer instance
    """
    if _cache_state["instance"] is None:
        redis_url = getattr(settings, "redis_url", None)
        _cache_state["instance"] = CacheLayer(redis_url=redis_url)
    return cast(CacheLayer, _cache_state["instance"])


def init_cache(redis_url: str | None = None, enable_redis: bool = True) -> CacheLayer:
    """Initialize global cache instance.

    Args:
        redis_url: Redis connection URL
        enable_redis: Whether to enable Redis

    Returns:
        Initialized CacheLayer instance
    """
    _cache_state["instance"] = CacheLayer(redis_url=redis_url, enable_redis=enable_redis)
    return cast(CacheLayer, _cache_state["instance"])


# Backwards-compatible cache API used by legacy tests
DEFAULT_TTL = CacheLayer.DEFAULT_TTL


def generate_cache_key(endpoint: str, params: dict[str, Any]) -> str:
    """Generate a deterministic legacy cache key."""
    serialized = json.dumps(params, sort_keys=True, separators=(",", ":"), default=str)
    digest = hashlib.sha256(serialized.encode()).hexdigest()
    return f"aiwebfeeds:cache:{endpoint}:{digest}"


class CacheService:
    """Compatibility wrapper preserving the older cache service API."""

    def __init__(self, redis_url: str | None = None, max_size: int = 100) -> None:
        self.redis: Any | None = None
        self._lru_cache: dict[str, Any] = {}
        self._lru_max_size = max_size

        if not REDIS_AVAILABLE or not redis_url:
            return

        try:
            parsed = urlparse(redis_url)
            self.redis = redis.Redis(
                host=parsed.hostname or "localhost",
                port=parsed.port or 6379,
                db=int(parsed.path.lstrip("/") or 0),
            )
        except Exception as exc:
            logger.warning(f"Failed to initialize legacy Redis cache: {exc}")
            self.redis = None

    def get(self, key: str) -> Any | None:
        """Get a cached value by key."""
        if self.redis is not None:
            try:
                cached = self.redis.get(key)
                if cached is not None:
                    if isinstance(cached, bytes):
                        cached = cached.decode()
                    return json.loads(cached)
            except Exception as exc:
                logger.warning(f"Legacy Redis get failed, using LRU fallback: {exc}")

        return self._lru_cache.get(key)

    def set(self, key: str, data: Any, ttl: int = DEFAULT_TTL) -> bool:
        """Cache a value by key."""
        if self.redis is not None:
            try:
                self.redis.set(key, json.dumps(data), ex=ttl)
                return True
            except Exception as exc:
                logger.warning(f"Legacy Redis set failed, using LRU fallback: {exc}")

        self._lru_cache[key] = data
        if len(self._lru_cache) > self._lru_max_size:
            oldest_key = next(iter(self._lru_cache))
            del self._lru_cache[oldest_key]
        return True

    def delete(self, key: str) -> bool:
        """Delete a cached value by key."""
        if self.redis is not None:
            try:
                self.redis.delete(key)
            except Exception as exc:
                logger.warning(f"Legacy Redis delete failed, continuing with LRU cleanup: {exc}")

        self._lru_cache.pop(key, None)
        return True

    def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate cached keys matching a Redis-style pattern."""
        deleted = 0
        if self.redis is not None:
            try:
                for key in self.redis.scan_iter(match=pattern):
                    self.redis.delete(key)
                    deleted += 1
            except Exception as exc:
                logger.warning(
                    f"Legacy Redis invalidate failed, continuing with LRU cleanup: {exc}"
                )

        if pattern.endswith("*"):
            prefix = pattern[:-1]
            matching_keys = [key for key in self._lru_cache if key.startswith(prefix)]
        else:
            matching_keys = [key for key in self._lru_cache if key == pattern]

        for key in matching_keys:
            self._lru_cache.pop(key, None)
            deleted += 1

        return deleted

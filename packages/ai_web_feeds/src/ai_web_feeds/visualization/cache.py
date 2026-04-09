"""Cache layer for visualization data with Redis and LRU fallback.

Implements FR-011a through FR-011c:
- Cache invalidation rules with 5-minute TTL
- Cache key generation using SHA-256 hashing
- Cache failure handling with Redis → LRU fallback
"""

import hashlib
import json
from collections import OrderedDict
from fnmatch import fnmatch
from time import time
from typing import Any

from loguru import logger

from ai_web_feeds.visualization.validators import normalize_cache_payload

try:
    import redis
    from redis.exceptions import ConnectionError, RedisError

    REDIS_AVAILABLE = True
    RedisClient = redis.Redis
except ImportError:
    REDIS_AVAILABLE = False
    RedisClient = Any
    logger.warning("redis-py not installed, using LRU cache fallback")


DEFAULT_TTL = 300
CACHE_VERSION = "v1"
TOPIC_GRAPH_TTL = DEFAULT_TTL


def generate_cache_key(endpoint: str, params: dict[str, Any]) -> str:
    """Generate the legacy cache-key format used by older tests/helpers."""
    payload = json.dumps(
        normalize_cache_payload(params),
        sort_keys=True,
        separators=(",", ":"),
    )
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    return f"aiwebfeeds:cache:{endpoint}:{digest}"


def generate_query_cache_key(
    query_type: str,
    filters: dict[str, Any],
    date_range: dict[str, str],
    device_id: str,
    *,
    cache_version: str = CACHE_VERSION,
) -> str:
    """Generate the versioned cache key used by live query consumers."""
    key_data = {
        "query_type": query_type,
        "filters": normalize_cache_payload(filters),
        "date_range": normalize_cache_payload(date_range),
        "device_id": device_id,
    }

    json_str = json.dumps(key_data, sort_keys=True, separators=(",", ":"))
    hash_digest = hashlib.sha256(json_str.encode("utf-8")).hexdigest()
    return f"{cache_version}:query:{query_type}:{hash_digest}"


class CacheService:
    """Compatibility cache service with Redis and in-memory fallback."""

    def __init__(self, redis_url: str | None = None):
        self.redis = None
        self._lru_cache: OrderedDict[str, tuple[Any, float | None]] = OrderedDict()
        self._lru_max_size = 100

        if REDIS_AVAILABLE and redis_url:
            try:
                if isinstance(redis.Redis, type) and hasattr(redis.Redis, "from_url"):
                    self.redis = redis.Redis.from_url(redis_url)
                else:
                    self.redis = redis.Redis()
            except Exception as exc:
                logger.warning(f"Legacy cache service falling back to LRU: {exc}")
                self.redis = None

    def get(self, key: str) -> Any | None:
        """Get a cached value by its fully materialized key."""
        if self.redis is not None:
            try:
                value = self.redis.get(key)
                if value is None:
                    return None
                if isinstance(value, bytes):
                    value = value.decode("utf-8")
                return json.loads(value)
            except Exception:
                pass

        entry = self._lru_cache.get(key)
        if entry is None:
            return None

        value, expires_at = entry
        if expires_at is not None and expires_at <= time():
            self._lru_cache.pop(key, None)
            return None

        self._lru_cache.move_to_end(key)
        return value

    def set(self, key: str, value: Any, ttl: int = DEFAULT_TTL) -> None:
        """Set a cached value by its fully materialized key."""
        serialized = json.dumps(value)
        if self.redis is not None:
            try:
                self.redis.set(key, serialized, ex=ttl)
                return
            except Exception:
                pass

        expires_at = time() + ttl if ttl > 0 else None
        self._lru_cache[key] = (value, expires_at)
        self._lru_cache.move_to_end(key)
        if len(self._lru_cache) > self._lru_max_size:
            self._lru_cache.popitem(last=False)

    def delete(self, key: str) -> None:
        """Delete a cache entry."""
        if self.redis is not None:
            try:
                self.redis.delete(key)
            except Exception:
                pass
        self._lru_cache.pop(key, None)

    def invalidate_pattern(self, pattern: str) -> None:
        """Invalidate cache entries matching a pattern."""
        if self.redis is not None:
            try:
                for key in self.redis.scan_iter(match=pattern):
                    self.redis.delete(key)
            except Exception:
                pass

        for key in [cache_key for cache_key in self._lru_cache if fnmatch(cache_key, pattern)]:
            del self._lru_cache[key]


class CacheLayer:
    """Cache layer with Redis (production) or LRU (development) fallback.

    Provides:
    - 5-minute TTL for analytics queries
    - Consistent cache key generation (SHA-256)
    - Automatic fallback to in-memory cache on Redis failure
    - Cache versioning for schema changes
    """

    CACHE_VERSION = CACHE_VERSION
    DEFAULT_TTL = 300  # 5 minutes in seconds
    LRU_MAX_SIZE = 100  # Maximum in-memory cache entries

    def __init__(
        self,
        redis_url: str | None = None,
        enable_redis: bool = True,
    ):
        """Initialize cache layer.

        Args:
            redis_url: Redis connection URL (e.g., redis://localhost:6379/0)
            enable_redis: Whether to attempt Redis connection
        """
        self.redis_client: RedisClient | None = None
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
            except (ConnectionError, RedisError) as e:
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

        Format: {version}:query:{query_type}:{hash}

        Args:
            query_type: Type of query (e.g., "topic_metrics", "feed_health")
            filters: Query filters (topics, feeds, etc.)
            date_range: Date range (start, end)
            device_id: User device identifier

        Returns:
            Versioned cache key string
        """
        return generate_query_cache_key(
            query_type,
            filters,
            date_range,
            device_id,
            cache_version=self.CACHE_VERSION,
        )

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
                    return json.loads(cached_data)
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

    def set(
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
        self._lru_set(cache_key, data, ttl=ttl)
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
                    redis_pattern = f"{self.CACHE_VERSION}:{pattern}"
                elif query_type:
                    redis_pattern = f"{self.CACHE_VERSION}:query:{query_type}:*"
                else:
                    redis_pattern = f"{self.CACHE_VERSION}:query:*"

                keys = self.redis_client.keys(redis_pattern)

                if keys:
                    count = self.redis_client.delete(*keys)
                    logger.info(f"Invalidated {count} cache entries from Redis")
            except RedisError as e:
                logger.error(f"Redis invalidation error: {e}")

        if pattern:
            lru_pattern = f"{self.CACHE_VERSION}:{pattern}"
        elif query_type:
            lru_pattern = f"{self.CACHE_VERSION}:query:{query_type}:*"
        else:
            lru_pattern = f"{self.CACHE_VERSION}:query:*"

        count += self._lru_invalidate(lru_pattern)
        logger.info("Cleared matching LRU cache entries")

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
                info = self.redis_client.info("stats")
                stats["redis_connected_clients"] = info.get("connected_clients", 0)
                stats["redis_total_commands"] = info.get("total_commands_processed", 0)
            except RedisError:
                pass

        return stats

    def _lru_get(self, key: str) -> Any | None:
        """Retrieve an item from the in-memory fallback cache."""
        if not hasattr(self, "_lru_storage"):
            self._lru_storage: OrderedDict[str, tuple[Any, float | None]] = OrderedDict()

        entry = self._lru_storage.get(key)
        if entry is None:
            return None

        data, expires_at = entry
        if expires_at is not None and expires_at <= time():
            self._lru_storage.pop(key, None)
            return None

        self._lru_storage.move_to_end(key)
        return data

    def _lru_set(self, key: str, data: Any, ttl: int = DEFAULT_TTL) -> None:
        """Store data in LRU cache."""
        if not hasattr(self, "_lru_storage"):
            self._lru_storage: OrderedDict[str, tuple[Any, float | None]] = OrderedDict()
        expires_at = time() + ttl if ttl > 0 else None
        self._lru_storage[key] = (data, expires_at)
        self._lru_storage.move_to_end(key)

        if len(self._lru_storage) > self.LRU_MAX_SIZE:
            self._lru_storage.popitem(last=False)

    def _lru_clear(self) -> None:
        """Clear LRU cache."""
        if hasattr(self, "_lru_storage"):
            self._lru_storage.clear()

    def _lru_invalidate(self, pattern: str) -> int:
        """Invalidate matching in-memory cache entries."""
        if not hasattr(self, "_lru_storage"):
            self._lru_storage = OrderedDict()

        matching_keys = [key for key in self._lru_storage if fnmatch(key, pattern)]
        for key in matching_keys:
            self._lru_storage.pop(key, None)
        return len(matching_keys)


# Global cache instance (initialized by config)
_cache_instance: CacheLayer | None = None


def get_cache() -> CacheLayer:
    """Get global cache instance.

    Returns:
        CacheLayer instance
    """
    global _cache_instance
    if _cache_instance is None:
        from ai_web_feeds.config import settings

        redis_url = getattr(settings, "redis_url", None)
        _cache_instance = CacheLayer(redis_url=redis_url)
    return _cache_instance


def init_cache(redis_url: str | None = None, enable_redis: bool = True) -> CacheLayer:
    """Initialize global cache instance.

    Args:
        redis_url: Redis connection URL
        enable_redis: Whether to enable Redis

    Returns:
        Initialized CacheLayer instance
    """
    global _cache_instance
    _cache_instance = CacheLayer(redis_url=redis_url, enable_redis=enable_redis)
    return _cache_instance

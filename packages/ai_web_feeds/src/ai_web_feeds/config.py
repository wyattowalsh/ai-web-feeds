"""ai_web_feeds.config -- AIWebFeeds configs

"""

from collections.abc import Callable
from typing import Any
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict



class LoggingConfig(BaseSettings): 
    """Logging-specific configs."""
      # Log level
    level: str = Field("INFO", description="Logging level")

      # Console sink
    console         : bool = Field(True, description="Enable console logging")
    console_colorize: bool = Field(True, description="Enable ANSI colorization for console logs")
    console_format  : str  = Field(
        "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
        "<level>{level: <8}</level> | "
        "<magenta>pid={process}</magenta> | "
        "<cyan>thr={thread.name}</cyan> | "
        "<blue>{name}</blue>:<blue>{function}</blue>:<blue>{line}</blue> - "
        "<level>{message}</level>",
        description = "Console log format (Loguru style, supports color tags)",
    )

      # File sink
    file          : bool = Field(False, description="Enable file logging")
    file_path     : str  = Field("logs/ai_web_feeds.log", description="Log file path")
    file_serialize: bool = Field(True, description="Serialize logs as JSON (structured logging)")
    file_format   : str  = Field(
        '{{"ts":"{time:YYYY-MM-DDTHH:mm:ss.SSSZ}",'
        '"lvl":"{level}","msg":"{message}","name":"{name}",'
        '"func":"{function}","line":{line},"pid":{process},"tid":{thread.id}}}',
        description = "File log format (used when serialize=False)",
    )
    file_rotation   : str = Field("10 MB", description="Rotate log file at this size/time")
    file_retention  : str = Field("14 days", description="How long to keep rotated logs")
    file_compression: str = Field("gz", description="Compression for rotated logs")

      # Common sink options
    enqueue  : bool = Field(True, description="Use a background thread to write logs")
    backtrace: bool = Field(True, description="Enable better tracebacks")
    diagnose : bool = Field(False, description="Verbose exception formatting (set True for debugging)")

class EmbeddingSettings(BaseSettings):
    """Embedding generation settings for semantic search."""
    provider          : str = Field("local", description="Embedding provider: 'local' or 'huggingface'")
    hf_api_token      : str = Field("", description="Hugging Face API token (optional, for HF provider)")
    hf_model          : str = Field("sentence-transformers/all-MiniLM-L6-v2", description="Hugging Face model name")
    local_model       : str = Field("sentence-transformers/all-MiniLM-L6-v2", description="Local model name")
    embedding_cache_size: int = Field(1000, description="LRU cache size for embeddings")


class AnalyticsSettings(BaseSettings):
    """Analytics caching and query settings."""
    static_cache_ttl    : int = Field(3600, description="Static metrics cache TTL (seconds), e.g., total_feeds, health_distribution")
    dynamic_cache_ttl   : int = Field(300, description="Dynamic metrics cache TTL (seconds), e.g., trending_topics, validation_success_rate")
    max_concurrent_queries: int = Field(10, description="Maximum concurrent analytics queries")


class SearchSettings(BaseSettings):
    """Search configuration for autocomplete and full-text search."""
    autocomplete_limit           : int   = Field(8, description="Max autocomplete suggestions (5 feeds + 3 topics)")
    full_text_limit              : int   = Field(20, description="Max full-text search results per page")
    semantic_similarity_threshold: float = Field(0.7, description="Minimum cosine similarity for semantic search")


class RecommendationSettings(BaseSettings):
    """Recommendation algorithm weights and constraints."""
    content_weight     : float = Field(0.7, description="Weight for content-based recommendations (topic similarity)")
    popularity_weight  : float = Field(0.2, description="Weight for popularity-based recommendations")
    serendipity_weight : float = Field(0.1, description="Weight for serendipity (random high-quality feeds)")


class Settings(BaseSettings):
    """Settings configs for AIWebFeeds."""
    logging        : LoggingConfig         = Field(default_factory=LoggingConfig, description="Logging configuration")
    embedding      : EmbeddingSettings     = Field(default_factory=EmbeddingSettings, description="Embedding configuration")
    analytics      : AnalyticsSettings     = Field(default_factory=AnalyticsSettings, description="Analytics configuration")
    search         : SearchSettings        = Field(default_factory=SearchSettings, description="Search configuration")
    recommendation : RecommendationSettings = Field(default_factory=RecommendationSettings, description="Recommendation configuration")

    # Enable nested env vars, e.g.:
    # AIWF_LOGGING__LEVEL=DEBUG
    # AIWF_LOGGING__FILE=True
    # AIWF_EMBEDDING__PROVIDER=huggingface
    # AIWF_ANALYTICS__STATIC_CACHE_TTL=7200
    model_config = SettingsConfigDict(
        env_prefix="AIWF_",
        env_nested_delimiter="__",
        extra="ignore",
    )
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

class Settings(BaseSettings):
    """Settings configs for AIWebFeeds."""
    logging: LoggingConfig = Field(default_factory=LoggingConfig, description="Logging configuration")

    # Enable nested env vars, e.g.:
    # AIWF_LOGGING__LEVEL=DEBUG
    # AIWF_LOGGING__FILE=True
    # AIWF_LOGGING__FILE_SERIALIZE=True
    # AIWF_LOGGING__FILE_ROTATION="50 MB"
    model_config = SettingsConfigDict(
        env_prefix="AIWF_",
        env_nested_delimiter="__",
        extra="ignore",
    )
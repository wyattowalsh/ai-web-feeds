"""ai_web_feeds.logger -- AIWebFeeds logging setup."""

import sys
from pathlib import Path

from loguru import logger

from ai_web_feeds.config import Settings

# Shared settings instance
_settings: Settings | None = None


def get_settings() -> Settings:
    """Get or create shared settings instance."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


settings = get_settings()

# Ensure log directory exists if file logging is enabled
if settings.logging.file:
    log_dir = Path(settings.logging.file_path).parent
    log_dir.mkdir(parents=True, exist_ok=True)

logger.remove()  # Remove default logger

if settings.logging.console:
    logger.add(
        sys.stdout,
        level=settings.logging.level,
        format=settings.logging.console_format,
        colorize=settings.logging.console_colorize,
        backtrace=settings.logging.backtrace,
        diagnose=settings.logging.diagnose,
        enqueue=settings.logging.enqueue,
    )

if settings.logging.file:
    logger.add(
        settings.logging.file_path,
        level=settings.logging.level,
        # format is ignored when serialize=True, but safe to pass
        format=settings.logging.file_format,
        serialize=settings.logging.file_serialize,
        rotation=settings.logging.file_rotation,
        retention=settings.logging.file_retention,
        compression=settings.logging.file_compression,
        backtrace=settings.logging.backtrace,
        diagnose=settings.logging.diagnose,
        enqueue=settings.logging.enqueue,
    )

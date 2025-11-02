"""ai_web_feeds.logger -- AIWebFeeds logging setup."""

import os
from pathlib import Path
import sys

from loguru import logger

from ai_web_feeds.config import Settings


settings = Settings()

# Ensure log directory exists if file logging is enabled
if settings.logging.file:
    log_dir = Path(settings.logging.file_path).parent
    os.makedirs(log_dir, exist_ok=True)

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

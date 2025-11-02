"""ai_web_feeds.load -- Load feed data from YAML files"""

from pathlib import Path
from typing import Any

from loguru import logger
import yaml


def load_feeds(path: Path | str) -> dict[str, Any]:
    """Load feeds from YAML file.

    Args:
        path: Path to feeds.yaml file

    Returns:
        Dictionary containing feeds data with 'sources' list

    Raises:
        FileNotFoundError: If the file doesn't exist
        yaml.YAMLError: If the YAML is invalid
    """
    path = Path(path)

    if not path.exists():
        msg = f"Feeds file not found: {path}"
        raise FileNotFoundError(msg)

    logger.info(f"Loading feeds from {path}")

    with path.open(encoding="utf-8") as f:
        data = yaml.safe_load(f)

    # Handle empty/None YAML files
    if data is None:
        data = {}

    sources = data.get("sources", [])
    logger.info(f"Loaded {len(sources)} feed sources")

    return data


def load_topics(path: Path | str) -> dict[str, Any]:
    """Load topics from YAML file.

    Args:
        path: Path to topics.yaml file

    Returns:
        Dictionary containing topics data

    Raises:
        FileNotFoundError: If the file doesn't exist
        yaml.YAMLError: If the YAML is invalid
    """
    path = Path(path)

    if not path.exists():
        msg = f"Topics file not found: {path}"
        raise FileNotFoundError(msg)

    logger.info(f"Loading topics from {path}")

    with path.open(encoding="utf-8") as f:
        data = yaml.safe_load(f)

    topics = data.get("topics", [])
    logger.info(f"Loaded {len(topics)} topics")

    return data


def save_feeds(data: dict[str, Any], path: Path | str) -> None:
    """Save feeds to YAML file.

    Args:
        data: Dictionary containing feeds data
        path: Output path for YAML file
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    logger.info(f"Saving feeds to {path}")

    with path.open("w", encoding="utf-8") as f:
        yaml.dump(data, f, default_flow_style=False, sort_keys=False, allow_unicode=True)

    sources_count = len(data.get("sources", []))
    logger.info(f"Saved {sources_count} feed sources to {path}")


def save_topics(data: dict[str, Any], path: Path | str) -> None:
    """Save topics to YAML file.

    Args:
        data: Dictionary containing topics data
        path: Output path for YAML file
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    logger.info(f"Saving topics to {path}")

    with path.open("w", encoding="utf-8") as f:
        yaml.dump(data, f, default_flow_style=False, sort_keys=False, allow_unicode=True)

    topics_count = len(data.get("topics", []))
    logger.info(f"Saved {topics_count} topics to {path}")

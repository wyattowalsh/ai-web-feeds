"""YAML load and save for feed catalogs."""

from pathlib import Path
from typing import Any, cast

import yaml
from loguru import logger


def load_feeds_yaml(path: Path | str) -> dict[str, Any]:
    """Load feeds from YAML file.

    Args:
        path: Path to YAML file

    Returns:
        Parsed YAML data
    """
    path = Path(path)
    with path.open() as f:
        return cast(dict[str, Any], yaml.safe_load(f) or {})


def save_feeds_yaml(data: dict[str, Any], path: Path | str) -> None:
    """Save feeds to YAML file.

    Args:
        data: Feed data to save
        path: Path to YAML file
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("w") as f:
        yaml.dump(
            data,
            f,
            default_flow_style=False,
            sort_keys=False,
            allow_unicode=True,
            width=120,
        )
    logger.info(f"Saved feeds YAML to {path}")

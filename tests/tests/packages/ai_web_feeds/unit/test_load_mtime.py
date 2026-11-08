"""Unit tests for mtime-cached YAML loading."""

import os
from collections.abc import Callable
from pathlib import Path
from typing import Any

import ai_web_feeds.load as load_module
import pytest


def _catalog_yaml(root_key: str, item_id: str) -> str:
    label_key = "title" if root_key == "feeds" else "name"
    return f"{root_key}:\n  - id: {item_id}\n    {label_key}: {item_id}\n"


def _touch_newer(path: Path) -> None:
    """Move mtime one second forward so the next load must re-parse."""
    current = path.stat()
    os.utime(path, ns=(current.st_atime_ns, current.st_mtime_ns + 1_000_000_000))


def _count_yaml_parses(monkeypatch: pytest.MonkeyPatch) -> dict[str, int]:
    parse_calls: dict[str, int] = {"count": 0}
    original_safe_load = load_module.yaml.safe_load

    def counting_safe_load(stream: Any) -> Any:
        parse_calls["count"] += 1
        return original_safe_load(stream)

    monkeypatch.setattr(load_module.yaml, "safe_load", counting_safe_load)
    return parse_calls


@pytest.mark.unit
class TestYamlMtimeCache:
    """Skip YAML re-parsing while the resolved path's mtime stays the same."""

    @pytest.mark.parametrize(
        ("loader", "root_key"),
        [
            (load_module.load_feeds, "feeds"),
            (load_module.load_topics, "topics"),
        ],
    )
    def test_unchanged_mtime_skips_reparse_until_file_is_touched(
        self,
        loader: Callable[[Path | str], dict[str, Any]],
        root_key: str,
        tmp_path: Path,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """A second load reuses the parse until the file mtime changes."""
        path = tmp_path / f"{root_key}.yaml"
        path.write_text(_catalog_yaml(root_key, "one"), encoding="utf-8")
        alias = path.parent / ".." / path.parent.name / path.name
        parse_calls = _count_yaml_parses(monkeypatch)

        assert alias.resolve() == path.resolve()

        first = loader(path)
        second = loader(alias)
        assert parse_calls["count"] == 1
        assert second == first
        assert second[root_key][0]["id"] == "one"

        second[root_key][0]["id"] = "mutated"
        cached = loader(path)
        assert parse_calls["count"] == 1
        assert cached[root_key][0]["id"] == "one"

        path.write_text(_catalog_yaml(root_key, "two"), encoding="utf-8")
        _touch_newer(path)
        refreshed = loader(path)

        assert parse_calls["count"] == 2
        assert refreshed[root_key][0]["id"] == "two"

    @pytest.mark.parametrize(
        ("loader", "root_key", "missing_message"),
        [
            (load_module.load_feeds, "feeds", "Feeds file not found"),
            (load_module.load_topics, "topics", "Topics file not found"),
        ],
    )
    def test_missing_file_is_not_cached_as_success(
        self,
        loader: Callable[[Path | str], dict[str, Any]],
        root_key: str,
        missing_message: str,
        tmp_path: Path,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """A missing path is not stored or replayed as a successful parse."""
        path = tmp_path / f"{root_key}.yaml"
        parse_calls = _count_yaml_parses(monkeypatch)

        with pytest.raises(FileNotFoundError, match=missing_message):
            loader(path)
        assert parse_calls["count"] == 0

        path.write_text(_catalog_yaml(root_key, "one"), encoding="utf-8")
        loaded = loader(path)
        assert loaded[root_key][0]["id"] == "one"
        assert parse_calls["count"] == 1

        stat_result = path.stat()
        mtime_ns = stat_result.st_mtime_ns
        path.unlink()
        with pytest.raises(FileNotFoundError, match=missing_message):
            loader(path)
        assert parse_calls["count"] == 1

        path.write_text(_catalog_yaml(root_key, "rewritten"), encoding="utf-8")
        os.utime(path, ns=(stat_result.st_atime_ns, mtime_ns))
        assert path.stat().st_mtime_ns == mtime_ns

        rewritten = loader(path)
        assert rewritten[root_key][0]["id"] == "rewritten"
        assert parse_calls["count"] == 2

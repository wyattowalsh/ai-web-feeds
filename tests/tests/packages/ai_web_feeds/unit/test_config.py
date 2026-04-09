"""Unit tests for ai_web_feeds.config module."""

from pathlib import Path

import ai_web_feeds.config as config_module
import pytest
from ai_web_feeds.config import (
    DEFAULT_DATABASE_URL,
    Settings,
    resolve_database_url,
    runtime_database_url,
)
from pydantic import ValidationError


def _sqlite_url(path: Path) -> str:
    return f"sqlite:///{path.as_posix()}"


@pytest.mark.unit
class TestSettings:
    """Test Settings configuration class."""

    def test_default_settings_use_repository_rooted_paths(self, monkeypatch, tmp_path):
        """Default paths should resolve from the repository root instead of cwd."""
        monkeypatch.setattr(config_module, "repository_root", lambda: tmp_path)

        settings = Settings()

        assert settings.data_dir == tmp_path / "data"
        assert settings.database_url == _sqlite_url(tmp_path / "data" / "ai-web-feeds.db")
        assert settings.logging.file_path == str(tmp_path / "logs" / "ai-web-feeds.log")

    def test_settings_from_env(self, monkeypatch, tmp_path):
        """Environment variables should override nested settings fields."""
        monkeypatch.setattr(config_module, "repository_root", lambda: tmp_path)
        monkeypatch.setenv("AIWF_LOGGING__LEVEL", "debug")
        monkeypatch.setenv("AIWF_LOGGING__FILE", "True")
        monkeypatch.setenv("AIWF_LOGGING__FILE_PATH", "logs/custom.log")

        settings = Settings()

        assert settings.logging.level == "DEBUG"
        assert settings.logging.file is True
        assert settings.logging.file_path == str(tmp_path / "logs" / "custom.log")

    def test_invalid_log_level_raises_clear_error(self, monkeypatch, tmp_path):
        """Invalid log levels should mention the canonical AIWF env var."""
        monkeypatch.setattr(config_module, "repository_root", lambda: tmp_path)
        monkeypatch.setenv("AIWF_LOGGING__LEVEL", "verbose")

        with pytest.raises(ValidationError, match="AIWF_LOGGING__LEVEL"):
            Settings()

    @pytest.mark.parametrize("log_level", ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"])
    def test_log_level_options(self, log_level, monkeypatch, tmp_path):
        """Supported log levels should normalize and validate successfully."""
        monkeypatch.setattr(config_module, "repository_root", lambda: tmp_path)
        monkeypatch.setenv("AIWF_LOGGING__LEVEL", log_level)

        settings = Settings()

        assert settings.logging.level == log_level

    def test_settings_immutability(self, monkeypatch, tmp_path):
        """Settings models should still reject unknown fields after instantiation."""
        monkeypatch.setattr(config_module, "repository_root", lambda: tmp_path)

        settings = Settings()

        with pytest.raises(Exception):
            settings.some_new_field = "value"

    def test_resolve_database_url_uses_legacy_when_canonical_missing(self, tmp_path, monkeypatch):
        """Prefer the legacy SQLite filename only for the canonical default location."""
        monkeypatch.setattr(config_module, "repository_root", lambda: tmp_path)
        legacy_path = tmp_path / "data" / "aiwebfeeds.db"
        legacy_path.parent.mkdir(parents=True, exist_ok=True)
        legacy_path.touch()

        assert resolve_database_url(DEFAULT_DATABASE_URL) == _sqlite_url(legacy_path)

    def test_runtime_database_url_honors_relative_env(self, tmp_path, monkeypatch):
        """AIWF_DATABASE_URL should resolve relative SQLite paths from the repository root."""
        monkeypatch.setattr(config_module, "repository_root", lambda: tmp_path)
        monkeypatch.setenv("AIWF_DATABASE_URL", "sqlite:///data/custom-runtime.db")

        assert runtime_database_url() == _sqlite_url(tmp_path / "data" / "custom-runtime.db")

    def test_runtime_database_url_preserves_explicit_non_sqlite_url(self, monkeypatch):
        """Non-SQLite URLs should pass through unchanged."""
        database_url = "postgresql://user:pass@localhost:5432/aiwebfeeds"
        monkeypatch.setenv("AIWF_DATABASE_URL", database_url)

        assert runtime_database_url() == database_url

    def test_resolve_database_url_rejects_empty_values(self):
        """Empty database URLs should produce a clear validation message."""
        with pytest.raises(ValueError, match="Database URL cannot be empty"):
            resolve_database_url("  ")

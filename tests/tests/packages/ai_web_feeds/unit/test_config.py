"""Unit tests for ai_web_feeds.config module."""

from pathlib import Path

import ai_web_feeds.config as config_module
import pytest
from ai_web_feeds.config import (
    DEFAULT_DATABASE_FILENAME,
    DEFAULT_DATABASE_URL,
    LEGACY_DATABASE_FILENAME,
    Settings,
    resolve_database_url,
)


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

    def test_resolve_database_url_prefers_canonical_when_available(self, tmp_path, monkeypatch):
        """Canonical sqlite paths should win when both database files exist."""
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        (data_dir / DEFAULT_DATABASE_FILENAME).write_bytes(b"")
        (data_dir / LEGACY_DATABASE_FILENAME).write_bytes(b"")
        monkeypatch.chdir(tmp_path)

        assert (
            resolve_database_url(DEFAULT_DATABASE_URL)
            == f"sqlite:///data/{DEFAULT_DATABASE_FILENAME}"
        )

    def test_resolve_database_url_falls_back_to_legacy_when_canonical_missing(
        self, tmp_path, monkeypatch
    ):
        """Legacy sqlite paths remain readable while the canonical file is absent."""
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        (data_dir / LEGACY_DATABASE_FILENAME).write_bytes(b"")
        monkeypatch.chdir(tmp_path)

        assert (
            resolve_database_url(DEFAULT_DATABASE_URL)
            == f"sqlite:///data/{LEGACY_DATABASE_FILENAME}"
        )

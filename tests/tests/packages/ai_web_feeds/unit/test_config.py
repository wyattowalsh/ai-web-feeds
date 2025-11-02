"""Unit tests for ai_web_feeds.config module."""

import pytest
from ai_web_feeds.config import Settings


@pytest.mark.unit
class TestSettings:
    """Test Settings configuration class."""

    def test_default_settings(self):
        """Test default settings values."""
        settings = Settings()
        assert settings is not None

    def test_settings_from_env(self, monkeypatch):
        """Test loading settings from environment variables."""
        monkeypatch.setenv("AIWF_LOGGING__LEVEL", "DEBUG")
        monkeypatch.setenv("AIWF_LOGGING__FILE", "True")

        settings = Settings()
        assert settings.logging.level == "DEBUG"
        assert settings.logging.file is True

    def test_settings_validation(self):
        """Test settings validation."""
        settings = Settings()
        # Should not raise validation errors
        assert settings.logging is not None
        assert settings.logging.level is not None

    @pytest.mark.parametrize("log_level", ["DEBUG", "INFO", "WARNING", "ERROR"])
    def test_log_level_options(self, log_level, monkeypatch):
        """Test different log level options."""
        monkeypatch.setenv("AIWF_LOGGING__LEVEL", log_level)
        settings = Settings()
        assert settings.logging.level == log_level

    def test_settings_immutability(self):
        """Test that settings are immutable after creation."""
        settings = Settings()
        with pytest.raises(Exception):
            settings.some_new_field = "value"

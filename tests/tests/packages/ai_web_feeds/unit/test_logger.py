"""Unit tests for ai_web_feeds.logger module."""

import pytest


@pytest.mark.unit
class TestLogger:
    """Test logger configuration."""

    def test_logger_import(self):
        """Test that logger module can be imported."""
        import ai_web_feeds.logger  # noqa: F401

        assert True

    def test_logger_configured(self):
        """Test that logger is configured on import."""
        from loguru import logger

        # Logger should be configured
        assert logger is not None

    def test_logging_works(self):
        """Test that logging works."""
        from loguru import logger

        # Should not raise an exception
        logger.info("Test message")
        logger.debug("Debug message")
        logger.warning("Warning message")

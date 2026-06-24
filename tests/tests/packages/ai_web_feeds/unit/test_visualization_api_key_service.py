"""Unit tests for ai_web_feeds.visualization.api_key_service module."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import pytest

from ai_web_feeds.visualization.api_key_service import (
    APIKeyService,
    verify_api_key_and_get_device,
)


@pytest.mark.unit
class TestAPIKeyService:
    """Test APIKeyService CRUD operations."""

    @pytest.mark.asyncio
    async def test_create_api_key_success(self):
        """Test successful API key creation."""
        service = APIKeyService()

        mock_session = MagicMock()
        mock_api_key = Mock()
        mock_api_key.id = 1
        mock_api_key.device_id = "device-123"
        mock_api_key.to_dict.return_value = {"id": 1, "name": "test-key"}

        def do_refresh(obj):
            obj.id = 1
            return None

        mock_session.__enter__ = Mock(return_value=mock_session)
        mock_session.__exit__ = Mock(return_value=False)
        mock_session.add = Mock()
        mock_session.commit = Mock()
        mock_session.refresh = Mock(side_effect=do_refresh)

        with patch("ai_web_feeds.visualization.api_key_service.get_session", return_value=mock_session):
            with patch("ai_web_feeds.visualization.api_key_service.generate_api_key", return_value=("plain-key", "hashed-key")):
                plaintext, record = await service.create_api_key("device-123", "test-key")

        assert plaintext == "plain-key"
        assert record.get("id") == 1
        mock_session.add.assert_called_once()
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_api_key_handles_exception(self):
        """Test exception handling in create."""
        service = APIKeyService()

        mock_session = MagicMock()
        mock_session.__enter__ = Mock(return_value=mock_session)
        mock_session.__exit__ = Mock(return_value=False)
        mock_session.add.side_effect = Exception("db error")

        with patch("ai_web_feeds.visualization.api_key_service.get_session", return_value=mock_session):
            with patch("ai_web_feeds.visualization.api_key_service.generate_api_key", return_value=("k", "h")):
                with pytest.raises(Exception):
                    await service.create_api_key("d", "n")

    @pytest.mark.asyncio
    async def test_list_api_keys_success(self):
        """Test listing non-revoked keys."""
        service = APIKeyService()

        mock_key = Mock()
        mock_key.to_dict.return_value = {"id": 1, "name": "k1"}
        mock_result = Mock()
        mock_result.scalars.return_value.all.return_value = [mock_key]

        mock_session = MagicMock()
        mock_session.__enter__ = Mock(return_value=mock_session)
        mock_session.__exit__ = Mock(return_value=False)
        mock_session.execute.return_value = mock_result

        with patch("ai_web_feeds.visualization.api_key_service.get_session", return_value=mock_session):
            keys = await service.list_api_keys("device-123")

        assert len(keys) == 1
        assert keys[0]["name"] == "k1"

    @pytest.mark.asyncio
    async def test_list_api_keys_empty_on_error(self):
        """Test list returns [] on error."""
        service = APIKeyService()

        mock_session = MagicMock()
        mock_session.__enter__ = Mock(return_value=mock_session)
        mock_session.__exit__ = Mock(return_value=False)
        mock_session.execute.side_effect = Exception("fail")

        with patch("ai_web_feeds.visualization.api_key_service.get_session", return_value=mock_session):
            keys = await service.list_api_keys("d")

        assert keys == []

    @pytest.mark.asyncio
    async def test_revoke_api_key_success(self):
        """Test revoking a key returns True."""
        service = APIKeyService()

        mock_result = Mock()
        mock_result.rowcount = 1

        mock_session = MagicMock()
        mock_session.__enter__ = Mock(return_value=mock_session)
        mock_session.__exit__ = Mock(return_value=False)
        mock_session.execute.return_value = mock_result
        mock_session.commit = Mock()

        with patch("ai_web_feeds.visualization.api_key_service.get_session", return_value=mock_session):
            result = await service.revoke_api_key(5, "device-123")

        assert result is True
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_revoke_api_key_not_found(self):
        """Test revoke returns False when no rows."""
        service = APIKeyService()

        mock_result = Mock()
        mock_result.rowcount = 0

        mock_session = MagicMock()
        mock_session.__enter__ = Mock(return_value=mock_session)
        mock_session.__exit__ = Mock(return_value=False)
        mock_session.execute.return_value = mock_result
        mock_session.commit = Mock()

        with patch("ai_web_feeds.visualization.api_key_service.get_session", return_value=mock_session):
            result = await service.revoke_api_key(99, "d")

        assert result is False

    @pytest.mark.asyncio
    async def test_revoke_api_key_exception_returns_false(self):
        """Test revoke swallows errors."""
        service = APIKeyService()

        mock_session = MagicMock()
        mock_session.__enter__ = Mock(return_value=mock_session)
        mock_session.__exit__ = Mock(return_value=False)
        mock_session.execute.side_effect = Exception("boom")

        with patch("ai_web_feeds.visualization.api_key_service.get_session", return_value=mock_session):
            result = await service.revoke_api_key(1, "d")

        assert result is False

    @pytest.mark.asyncio
    async def test_log_api_usage_success(self):
        """Test logging usage and updating count."""
        service = APIKeyService()

        mock_session = MagicMock()
        mock_session.__enter__ = Mock(return_value=mock_session)
        mock_session.__exit__ = Mock(return_value=False)
        mock_session.add = Mock()
        mock_session.execute = Mock()
        mock_session.commit = Mock()

        with patch("ai_web_feeds.visualization.api_key_service.get_session", return_value=mock_session):
            await service.log_api_usage(
                api_key_id=1,
                endpoint="/export",
                request_params={"a": 1},
                response_status=200,
                records_exported=10,
                response_time_ms=123,
            )

        mock_session.add.assert_called_once()
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_log_api_usage_swallows_error(self):
        """Test log errors are swallowed."""
        service = APIKeyService()

        mock_session = MagicMock()
        mock_session.__enter__ = Mock(return_value=mock_session)
        mock_session.__exit__ = Mock(return_value=False)
        mock_session.add.side_effect = Exception("log fail")

        with patch("ai_web_feeds.visualization.api_key_service.get_session", return_value=mock_session):
            # Should not raise
            await service.log_api_usage(1, "/x", {}, 200, None, 10)


@pytest.mark.unit
class TestVerifyAPIKeyAndGetDevice:
    """Test standalone verify helper."""

    @pytest.mark.asyncio
    async def test_verify_returns_device_on_match(self):
        """Valid key returns device_id."""
        mock_key = Mock()
        mock_key.device_id = "dev-42"
        mock_key.key_hash = "hash"
        mock_result = Mock()
        mock_result.scalars.return_value.all.return_value = [mock_key]

        mock_session = MagicMock()
        mock_session.__enter__ = Mock(return_value=mock_session)
        mock_session.__exit__ = Mock(return_value=False)
        mock_session.execute.return_value = mock_result

        with patch("ai_web_feeds.visualization.api_key_service.get_session", return_value=mock_session):
            with patch("ai_web_feeds.visualization.api_key_service.verify_api_key_hash", return_value=True):
                dev = await verify_api_key_and_get_device("plain")

        assert dev == "dev-42"

    @pytest.mark.asyncio
    async def test_verify_returns_none_on_no_match(self):
        """No matching hash returns None."""
        mock_key = Mock()
        mock_key.key_hash = "other"
        mock_result = Mock()
        mock_result.scalars.return_value.all.return_value = [mock_key]

        mock_session = MagicMock()
        mock_session.__enter__ = Mock(return_value=mock_session)
        mock_session.__exit__ = Mock(return_value=False)
        mock_session.execute.return_value = mock_result

        with patch("ai_web_feeds.visualization.api_key_service.get_session", return_value=mock_session):
            with patch("ai_web_feeds.visualization.api_key_service.verify_api_key_hash", return_value=False):
                dev = await verify_api_key_and_get_device("plain")

        assert dev is None

    @pytest.mark.asyncio
    async def test_verify_returns_none_on_exception(self):
        """Errors return None."""
        mock_session = MagicMock()
        mock_session.__enter__ = Mock(return_value=mock_session)
        mock_session.__exit__ = Mock(return_value=False)
        mock_session.execute.side_effect = Exception("db")

        with patch("ai_web_feeds.visualization.api_key_service.get_session", return_value=mock_session):
            dev = await verify_api_key_and_get_device("k")

        assert dev is None

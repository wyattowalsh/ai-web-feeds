"""API key management service.

Implements FR-065: API key generation, verification, and management
"""

from datetime import datetime
from typing import Optional

from loguru import logger
from sqlalchemy import select, update

from ai_web_feeds.storage import get_session
from ai_web_feeds.visualization.models import APIKey, APIUsage
from ai_web_feeds.visualization.auth import (
    generate_api_key,
    verify_api_key as verify_api_key_hash,
)


class APIKeyService:
    """Service for managing API keys."""

    async def create_api_key(
        self,
        device_id: str,
        name: str,
    ) -> tuple[str, dict[str, any]]:
        """Create a new API key.

        Args:
            device_id: Device identifier
            name: User-defined key name

        Returns:
            Tuple of (plaintext_key, key_record)
            Note: Plaintext key is only returned once!
        """
        # Generate key
        plaintext_key, key_hash = generate_api_key()

        try:
            with get_session() as session:
                api_key = APIKey(
                    device_id=device_id,
                    key_hash=key_hash,
                    name=name,
                )

                session.add(api_key)
                session.commit()
                session.refresh(api_key)

                logger.info(f"Created API key {api_key.id} for device {device_id[:8]}")

                # Return plaintext key (only time it's visible)
                return plaintext_key, api_key.to_dict()
        except Exception as e:
            logger.error(f"Error creating API key: {e}")
            raise

    async def list_api_keys(
        self,
        device_id: str,
    ) -> list[dict[str, any]]:
        """List all API keys for a device.

        Args:
            device_id: Device identifier

        Returns:
            List of API key records (without key_hash)
        """
        try:
            with get_session() as session:
                statement = (
                    select(APIKey)
                    .where(
                        APIKey.device_id == device_id,
                        APIKey.is_revoked == False,
                    )
                    .order_by(APIKey.created_at.desc())
                )

                result = session.execute(statement)
                api_keys = result.scalars().all()

                return [key.to_dict() for key in api_keys]
        except Exception as e:
            logger.error(f"Error listing API keys: {e}")
            return []

    async def revoke_api_key(
        self,
        key_id: int,
        device_id: str,
    ) -> bool:
        """Revoke an API key.

        Args:
            key_id: API key ID
            device_id: Device identifier (for access control)

        Returns:
            True if revoked successfully
        """
        try:
            with get_session() as session:
                statement = (
                    update(APIKey)
                    .where(
                        APIKey.id == key_id,
                        APIKey.device_id == device_id,
                    )
                    .values(is_revoked=True)
                )

                result = session.execute(statement)
                session.commit()

                revoked = result.rowcount > 0

                if revoked:
                    logger.info(f"Revoked API key {key_id}")
                else:
                    logger.warning(f"API key {key_id} not found")

                return revoked
        except Exception as e:
            logger.error(f"Error revoking API key {key_id}: {e}")
            return False

    async def log_api_usage(
        self,
        api_key_id: int,
        endpoint: str,
        request_params: dict[str, any],
        response_status: int,
        records_exported: Optional[int],
        response_time_ms: int,
    ) -> None:
        """Log API usage.

        Args:
            api_key_id: API key ID
            endpoint: API endpoint called
            request_params: Request parameters
            response_status: HTTP response status
            records_exported: Number of records exported (if applicable)
            response_time_ms: Response time in milliseconds
        """
        try:
            with get_session() as session:
                usage = APIUsage(
                    api_key_id=api_key_id,
                    endpoint=endpoint,
                    request_params=request_params,
                    response_status=response_status,
                    records_exported=records_exported,
                    response_time_ms=response_time_ms,
                )

                session.add(usage)

                # Update API key's request count and last_used_at
                statement = (
                    update(APIKey)
                    .where(APIKey.id == api_key_id)
                    .values(
                        request_count=APIKey.request_count + 1,
                        last_used_at=datetime.utcnow(),
                    )
                )
                session.execute(statement)

                session.commit()
        except Exception as e:
            logger.error(f"Error logging API usage: {e}")


async def verify_api_key_and_get_device(plaintext_key: str) -> Optional[str]:
    """Verify API key and return device ID.

    Args:
        plaintext_key: User-provided API key

    Returns:
        Device ID if key is valid and not revoked, None otherwise
    """
    try:
        with get_session() as session:
            # Get all non-revoked keys (need to check hash)
            statement = select(APIKey).where(
                APIKey.is_revoked == False,
            )

            result = session.execute(statement)
            api_keys = result.scalars().all()

            # Check each key's hash
            for api_key in api_keys:
                if verify_api_key_hash(plaintext_key, api_key.key_hash):
                    # Valid key found
                    logger.debug(f"Valid API key {api_key.id} authenticated")
                    return api_key.device_id

            # No matching key found
            logger.warning("Invalid API key provided")
            return None
    except Exception as e:
        logger.error(f"Error verifying API key: {e}")
        return None

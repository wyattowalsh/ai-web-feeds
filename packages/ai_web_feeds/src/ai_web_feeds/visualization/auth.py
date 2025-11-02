"""Authentication utilities for visualization API.

Implements FR-055 through FR-065:
- JWT token generation and verification
- API key generation and verification
- Device ID extraction
- Rate limiting
"""

import secrets
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
import jwt
from fastapi import Header, HTTPException, status
from loguru import logger

from ai_web_feeds.config import settings


# JWT configuration
JWT_SECRET_KEY = getattr(settings, "jwt_secret_key", secrets.token_urlsafe(32))
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS = 30

# API key configuration
API_KEY_PREFIX = "awf_"
API_KEY_LENGTH = 32


def create_jwt_token(device_id: str) -> str:
    """Create JWT token for device.

    Args:
        device_id: Device UUID

    Returns:
        Encoded JWT token
    """
    payload = {
        "device_id": device_id,
        "exp": datetime.utcnow() + timedelta(days=JWT_EXPIRATION_DAYS),
        "iat": datetime.utcnow(),
    }

    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return token


def verify_jwt_token(token: str) -> Optional[str]:
    """Verify JWT token and extract device ID.

    Args:
        token: JWT token string

    Returns:
        Device ID if valid, None otherwise
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        device_id = payload.get("device_id")

        if not device_id:
            return None

        return device_id
    except jwt.ExpiredSignatureError:
        logger.warning("JWT token expired")
        return None
    except jwt.InvalidTokenError:
        logger.warning("Invalid JWT token")
        return None


def generate_api_key() -> tuple[str, str]:
    """Generate a new API key.

    Returns:
        Tuple of (plaintext_key, hashed_key)
    """
    # Generate random key
    random_part = secrets.token_urlsafe(API_KEY_LENGTH)
    plaintext_key = f"{API_KEY_PREFIX}{random_part}"

    # Hash with bcrypt
    hashed_key = bcrypt.hashpw(
        plaintext_key.encode(),
        bcrypt.gensalt(rounds=12),
    ).decode()

    return plaintext_key, hashed_key


def verify_api_key(plaintext_key: str, hashed_key: str) -> bool:
    """Verify API key against stored hash.

    Args:
        plaintext_key: User-provided key
        hashed_key: Stored bcrypt hash

    Returns:
        True if key is valid
    """
    try:
        return bcrypt.checkpw(
            plaintext_key.encode(),
            hashed_key.encode(),
        )
    except Exception as e:
        logger.error(f"API key verification error: {e}")
        return False


async def get_current_device_id(
    authorization: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None),
) -> str:
    """Extract device ID from JWT token or API key.

    This is a FastAPI dependency that checks both authentication methods.

    Args:
        authorization: Authorization header (Bearer token)
        x_api_key: API key header

    Returns:
        Device ID

    Raises:
        HTTPException: If authentication fails
    """
    # Try JWT token first
    if authorization:
        if not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authorization header format",
            )

        token = authorization.replace("Bearer ", "")
        device_id = verify_jwt_token(token)

        if device_id:
            return device_id

    # Try API key
    if x_api_key:
        # Look up API key in database
        from ai_web_feeds.visualization.api_key_service import verify_api_key_and_get_device

        device_id = await verify_api_key_and_get_device(x_api_key)

        if device_id:
            return device_id

    # No valid authentication
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required (provide JWT token or API key)",
        headers={"WWW-Authenticate": "Bearer"},
    )


def validate_device_id(device_id: str) -> bool:
    """Validate device ID format.

    Args:
        device_id: Device UUID string

    Returns:
        True if valid UUID format
    """
    import re

    uuid_pattern = re.compile(
        r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
        re.IGNORECASE,
    )
    return bool(uuid_pattern.match(device_id))

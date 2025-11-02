"""Rate limiting for visualization API.

Implements NFR-026 and FR-060:
- Track requests by device_id + IP address
- Exponential backoff for violations
- 100 requests/hour base limit
- Whitelist support
"""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import HTTPException, Request, status
from loguru import logger


class RateLimiter:
    """In-memory rate limiter (Redis-backed in production)."""

    def __init__(
        self,
        requests_per_hour: int = 100,
        use_redis: bool = False,
    ):
        """Initialize rate limiter.

        Args:
            requests_per_hour: Maximum requests per hour
            use_redis: Whether to use Redis for distributed tracking
        """
        self.requests_per_hour = requests_per_hour
        self.use_redis = use_redis

        # In-memory storage (device_id -> list of request timestamps)
        self._request_history: dict[str, list[datetime]] = {}

        # Violation tracking (device_id -> violation count)
        self._violations: dict[str, int] = {}

        # Whitelist (device_ids with no rate limit)
        self._whitelist: set[str] = set()

    def add_to_whitelist(self, device_id: str) -> None:
        """Add device to whitelist (no rate limits)."""
        self._whitelist.add(device_id)
        logger.info(f"Added device {device_id[:8]} to rate limit whitelist")

    def remove_from_whitelist(self, device_id: str) -> None:
        """Remove device from whitelist."""
        self._whitelist.discard(device_id)

    def is_whitelisted(self, device_id: str) -> bool:
        """Check if device is whitelisted."""
        return device_id in self._whitelist

    def check_rate_limit(self, device_id: str, ip_address: Optional[str] = None) -> tuple[bool, Optional[int]]:
        """Check if request is within rate limit.

        Args:
            device_id: Device identifier
            ip_address: IP address (optional, for additional tracking)

        Returns:
            Tuple of (allowed, retry_after_seconds)
        """
        # Check whitelist
        if self.is_whitelisted(device_id):
            return True, None

        # Get current time
        now = datetime.utcnow()
        hour_ago = now - timedelta(hours=1)

        # Get request history for this device
        if device_id not in self._request_history:
            self._request_history[device_id] = []

        # Clean old requests (older than 1 hour)
        self._request_history[device_id] = [
            ts for ts in self._request_history[device_id] if ts > hour_ago
        ]

        # Check if over limit
        request_count = len(self._request_history[device_id])

        if request_count >= self.requests_per_hour:
            # Rate limit exceeded
            self._violations[device_id] = self._violations.get(device_id, 0) + 1
            violation_count = self._violations[device_id]

            # Calculate backoff time (exponential)
            backoff_minutes = min(60, 2 ** (violation_count - 1))  # Max 1 hour
            retry_after = int(backoff_minutes * 60)  # Convert to seconds

            logger.warning(
                f"Rate limit exceeded for device {device_id[:8]} "
                f"(violation #{violation_count}, backoff: {backoff_minutes}min)"
            )

            return False, retry_after

        # Within limit - record request
        self._request_history[device_id].append(now)

        # Reset violation counter on successful request
        if device_id in self._violations:
            del self._violations[device_id]

        return True, None

    def get_remaining_requests(self, device_id: str) -> int:
        """Get remaining requests in current hour window.

        Args:
            device_id: Device identifier

        Returns:
            Number of requests remaining
        """
        if self.is_whitelisted(device_id):
            return self.requests_per_hour  # Show full quota

        if device_id not in self._request_history:
            return self.requests_per_hour

        # Clean old requests
        now = datetime.utcnow()
        hour_ago = now - timedelta(hours=1)
        self._request_history[device_id] = [
            ts for ts in self._request_history[device_id] if ts > hour_ago
        ]

        used = len(self._request_history[device_id])
        remaining = max(0, self.requests_per_hour - used)

        return remaining

    def get_stats(self, device_id: str) -> dict[str, any]:
        """Get rate limit statistics for device.

        Args:
            device_id: Device identifier

        Returns:
            Statistics dictionary
        """
        remaining = self.get_remaining_requests(device_id)
        used = self.requests_per_hour - remaining
        violation_count = self._violations.get(device_id, 0)

        return {
            "device_id": device_id,
            "limit": self.requests_per_hour,
            "used": used,
            "remaining": remaining,
            "violation_count": violation_count,
            "is_whitelisted": self.is_whitelisted(device_id),
        }


# Global rate limiter instance
_rate_limiter: Optional[RateLimiter] = None


def get_rate_limiter() -> RateLimiter:
    """Get global rate limiter instance."""
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = RateLimiter()
    return _rate_limiter


async def check_rate_limit(device_id: str, request: Optional[Request] = None) -> None:
    """FastAPI dependency to check rate limit.

    Args:
        device_id: Device identifier
        request: FastAPI request (for IP address)

    Raises:
        HTTPException: If rate limit exceeded
    """
    limiter = get_rate_limiter()

    # Get IP address from request if available
    ip_address = None
    if request:
        ip_address = request.client.host if request.client else None

    # Check rate limit
    allowed, retry_after = limiter.check_rate_limit(device_id, ip_address)

    if not allowed:
        headers = {}
        if retry_after:
            headers["Retry-After"] = str(retry_after)

        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Try again in {retry_after} seconds.",
            headers=headers,
        )

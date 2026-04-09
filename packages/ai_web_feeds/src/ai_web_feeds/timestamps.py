"""UTC timestamp helpers for storage and query comparisons."""

from datetime import UTC, datetime


def utc_now() -> datetime:
    """Return a naive UTC timestamp for database storage."""
    return datetime.now(UTC).replace(tzinfo=None)


def normalize_utc_datetime(value: datetime | None) -> datetime | None:
    """Normalize a datetime value to naive UTC."""
    if value is None:
        return None
    if value.tzinfo is None:
        return value
    return value.astimezone(UTC).replace(tzinfo=None)


def utc_date_string(value: datetime | None = None) -> str:
    """Return an ISO date string for a UTC timestamp."""
    normalized = normalize_utc_datetime(value) if value is not None else utc_now()
    return normalized.date().isoformat()

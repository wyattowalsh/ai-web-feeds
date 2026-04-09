"""Helpers for validating and scheduling email digests."""

from datetime import UTC, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from croniter import CroniterBadCronError, croniter

DEFAULT_DIGEST_CRONS: dict[str, str] = {
    "daily": "0 9 * * *",
    "weekly": "0 9 * * 1",
}


def normalize_schedule_type(schedule_type: object) -> str:
    """Return the schedule type string from enum or raw input."""
    return getattr(schedule_type, "value", schedule_type)


def ensure_utc(value: datetime) -> datetime:
    """Normalize datetime values to UTC while tolerating legacy naive rows."""
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def validate_timezone_name(timezone_name: str | None) -> str:
    """Return a validated IANA timezone name."""
    normalized_timezone = timezone_name or "UTC"
    try:
        ZoneInfo(normalized_timezone)
    except ZoneInfoNotFoundError as exc:
        msg = f"Invalid timezone: {normalized_timezone}"
        raise ValueError(msg) from exc
    return normalized_timezone


def resolve_schedule_cron(schedule_type: object, schedule_cron: str | None) -> str:
    """Resolve the effective cron expression for a digest schedule."""
    normalized_schedule_type = normalize_schedule_type(schedule_type)
    if normalized_schedule_type == "custom":
        if not schedule_cron:
            msg = "schedule_cron is required for custom schedules"
            raise ValueError(msg)
        return schedule_cron

    default_cron = DEFAULT_DIGEST_CRONS.get(normalized_schedule_type)
    if default_cron is None:
        msg = f"Invalid schedule_type: {normalized_schedule_type}"
        raise ValueError(msg)
    return schedule_cron or default_cron


def validate_cron_expression(cron_expr: str) -> str:
    """Validate a cron expression and return the normalized value."""
    if not cron_expr:
        msg = "schedule_cron is required"
        raise ValueError(msg)

    try:
        croniter(cron_expr, datetime.now(UTC))
    except CroniterBadCronError as exc:
        msg = f"Invalid schedule_cron: {cron_expr}"
        raise ValueError(msg) from exc
    return cron_expr


def validate_digest_schedule(
    schedule_type: object,
    schedule_cron: str | None,
    timezone_name: str | None,
) -> tuple[str, str]:
    """Validate and normalize digest schedule inputs."""
    timezone_value = validate_timezone_name(timezone_name)
    cron_expr = validate_cron_expression(resolve_schedule_cron(schedule_type, schedule_cron))
    return cron_expr, timezone_value


def calculate_next_send_at(
    schedule_type: object,
    schedule_cron: str | None,
    timezone_name: str | None,
    from_time: datetime,
) -> datetime:
    """Return the next UTC send time for the given schedule."""
    cron_expr, normalized_timezone = validate_digest_schedule(
        schedule_type=schedule_type,
        schedule_cron=schedule_cron,
        timezone_name=timezone_name,
    )
    user_timezone = ZoneInfo(normalized_timezone)
    localized_from_time = ensure_utc(from_time).astimezone(user_timezone)
    next_local = croniter(cron_expr, localized_from_time).get_next(datetime)
    if next_local.tzinfo is None:
        next_local = next_local.replace(tzinfo=user_timezone)
    return next_local.astimezone(UTC)

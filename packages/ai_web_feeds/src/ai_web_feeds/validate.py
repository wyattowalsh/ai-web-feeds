"""ai_web_feeds.validate -- Validate feed data against schemas and URLs"""

import asyncio
from datetime import datetime, timedelta
import json
from pathlib import Path
from typing import Any

import feedparser
import httpx
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential
from tqdm.asyncio import tqdm as async_tqdm

from ai_web_feeds.models import FeedSource, FeedValidationResult


class ValidationError(Exception):
    """Custom validation error."""


class ValidationResult:
    """Result of a validation operation."""

    def __init__(self, valid: bool = True, errors: list[str] | None = None):
        self.valid = valid
        self.errors = errors or []

    def add_error(self, error: str) -> None:
        """Add an error to the result."""
        self.valid = False
        self.errors.append(error)

    def __bool__(self) -> bool:
        """Return True if validation passed."""
        return self.valid


def validate_feeds(data: dict[str, Any], schema_path: Path | str | None = None) -> ValidationResult:
    """Validate feeds data against JSON schema.

    Args:
        data: Feeds data dictionary
        schema_path: Optional path to JSON schema file

    Returns:
        ValidationResult object

    Raises:
        ImportError: If jsonschema is not installed
    """
    try:
        import jsonschema
    except ImportError as e:
        msg = "jsonschema not installed. Run: uv pip install jsonschema"
        raise ImportError(msg) from e

    result = ValidationResult()

    # Load schema if provided
    schema = None
    if schema_path:
        schema_path = Path(schema_path)
        if schema_path.exists():
            with schema_path.open(encoding="utf-8") as f:
                schema = json.load(f)
            logger.debug(f"Loaded schema from {schema_path}")

    # Validate against schema if available
    if schema:
        try:
            jsonschema.validate(instance=data, schema=schema)
            logger.info("Schema validation passed")
        except jsonschema.ValidationError as e:
            error_msg = f"Schema validation failed: {e.message}"
            logger.error(error_msg)
            result.add_error(error_msg)

    # Additional validations
    sources = data.get("sources", [])

    # Handle sources not being a list (schema validation should catch this)
    if not isinstance(sources, list):
        sources = []

    logger.info(f"Validating {len(sources)} feed sources")

    # Check for duplicate IDs
    ids = [s.get("id") for s in sources if s.get("id")]
    duplicates = [id for id in set(ids) if ids.count(id) > 1]

    if duplicates:
        error_msg = f"Duplicate IDs found: {', '.join(duplicates)}"
        logger.error(error_msg)
        result.add_error(error_msg)
    else:
        logger.debug("No duplicate IDs found")

    # Check for required fields
    for i, source in enumerate(sources):
        if not source.get("id"):
            error_msg = f"Source at index {i} missing required field: id"
            logger.error(error_msg)
            result.add_error(error_msg)

        if not source.get("title"):
            error_msg = f"Source '{source.get('id', i)}' missing required field: title"
            logger.error(error_msg)
            result.add_error(error_msg)

    if result.valid:
        logger.info("All validations passed!")

    return result


def validate_topics(
    data: dict[str, Any], schema_path: Path | str | None = None
) -> ValidationResult:
    """Validate topics data against JSON schema.

    Args:
        data: Topics data dictionary
        schema_path: Optional path to JSON schema file

    Returns:
        ValidationResult object

    Raises:
        ImportError: If jsonschema is not installed
    """
    try:
        import jsonschema
    except ImportError as e:
        msg = "jsonschema not installed. Run: uv pip install jsonschema"
        raise ImportError(msg) from e

    result = ValidationResult()

    # Load schema if provided
    schema = None
    if schema_path:
        schema_path = Path(schema_path)
        if schema_path.exists():
            with schema_path.open(encoding="utf-8") as f:
                schema = json.load(f)
            logger.debug(f"Loaded schema from {schema_path}")

    # Validate against schema if available
    if schema:
        try:
            jsonschema.validate(instance=data, schema=schema)
            logger.info("Schema validation passed")
        except jsonschema.ValidationError as e:
            error_msg = f"Schema validation failed: {e.message}"
            logger.error(error_msg)
            result.add_error(error_msg)

    # Additional validations
    topics = data.get("topics", [])
    logger.info(f"Validating {len(topics)} topics")

    # Check for duplicate IDs
    ids = [t.get("id") for t in topics if t.get("id")]
    duplicates = [id for id in set(ids) if ids.count(id) > 1]

    if duplicates:
        error_msg = f"Duplicate topic IDs found: {', '.join(duplicates)}"
        logger.error(error_msg)
        result.add_error(error_msg)

    if result.valid:
        logger.info("All topic validations passed!")

    return result


# ============================================================================
# Async HTTP Feed Validation
# ============================================================================


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    reraise=True,
)
async def validate_feed_url(
    feed_url: str,
    timeout: float = 30.0,
) -> dict[str, Any]:
    """Validate a feed URL with HTTP accessibility check and format parsing.

    Args:
        feed_url: The feed URL to validate
        timeout: HTTP request timeout in seconds

    Returns:
        Validation result dictionary with success, status_code, response_time, error_message, etc.
    """
    start_time = datetime.now()
    result = {
        "url": feed_url,
        "success": False,
        "status_code": None,
        "response_time_ms": None,
        "error_message": None,
        "feed_format": None,
        "entry_count": 0,
        "validated_at": start_time,
    }

    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            response = await client.get(feed_url)

            # Record timing
            response_time = (datetime.now() - start_time).total_seconds() * 1000
            result["response_time_ms"] = round(response_time, 2)
            result["status_code"] = response.status_code

            # Check HTTP status
            if response.status_code != 200:
                result["error_message"] = f"HTTP {response.status_code}"
                return result

            # Parse feed content
            feed_content = response.text
            parsed_feed = feedparser.parse(feed_content)

            # Check if feed is valid
            if hasattr(parsed_feed, "bozo") and parsed_feed.bozo:
                # Feed has parse errors
                bozo_exception = getattr(parsed_feed, "bozo_exception", None)
                result["error_message"] = f"Feed parse error: {bozo_exception}"
                # Still might be usable, so don't return yet

            # Detect feed format
            feed_format = "unknown"
            if parsed_feed.get("version"):
                version = parsed_feed["version"].lower()
                if "rss" in version:
                    feed_format = "rss"
                elif "atom" in version:
                    feed_format = "atom"

            result["feed_format"] = feed_format
            result["entry_count"] = len(parsed_feed.get("entries", []))

            # Success if we got entries or a valid feed structure
            if result["entry_count"] > 0 or parsed_feed.get("feed", {}).get("title"):
                result["success"] = True
                result["error_message"] = None
            else:
                result["error_message"] = "No entries found in feed"

    except httpx.TimeoutException:
        result["error_message"] = f"Timeout after {timeout}s"
    except httpx.RequestError as e:
        result["error_message"] = f"Request error: {e!s}"
    except Exception as e:
        result["error_message"] = f"Unexpected error: {e!s}"
        logger.exception(f"Error validating feed {feed_url}")

    return result


async def validate_feed(feed_source: FeedSource) -> FeedValidationResult:
    """Validate a single feed source and return validation result model.

    Args:
        feed_source: FeedSource model to validate

    Returns:
        FeedValidationResult model
    """
    # Use feed URL, fallback to site URL
    url_to_validate = feed_source.feed or feed_source.site

    if not url_to_validate:
        return FeedValidationResult(
            feed_source_id=feed_source.id,
            success=False,
            error_message="No feed or site URL provided",
            validated_at=datetime.now(),
        )

    # Validate URL
    result_dict = await validate_feed_url(url_to_validate)

    # Convert to FeedValidationResult model
    return FeedValidationResult(
        feed_source_id=feed_source.id,
        success=result_dict["success"],
        status_code=result_dict["status_code"],
        response_time_ms=result_dict["response_time_ms"],
        error_message=result_dict["error_message"],
        feed_format=result_dict["feed_format"],
        entry_count=result_dict["entry_count"],
        validated_at=result_dict["validated_at"],
    )


async def validate_all_feeds(
    feed_sources: list[FeedSource],
    concurrency_limit: int = 10,
    show_progress: bool = True,
) -> list[FeedValidationResult]:
    """Validate multiple feeds with concurrency control and progress tracking.

    Args:
        feed_sources: List of FeedSource models to validate
        concurrency_limit: Maximum concurrent HTTP requests
        show_progress: Whether to show progress bar

    Returns:
        List of FeedValidationResult models
    """
    semaphore = asyncio.Semaphore(concurrency_limit)

    async def validate_with_semaphore(feed: FeedSource) -> FeedValidationResult:
        async with semaphore:
            return await validate_feed(feed)

    # Create validation tasks
    tasks = [validate_with_semaphore(feed) for feed in feed_sources]

    # Execute with progress bar
    if show_progress:
        results = await async_tqdm.gather(
            *tasks,
            desc="Validating feeds",
            total=len(feed_sources),
        )
    else:
        results = await asyncio.gather(*tasks)

    return results


def calculate_health_score(
    validation_results: list[FeedValidationResult],
    max_results: int = 10,
) -> float:
    """Calculate health score based on recent validation history.

    Args:
        validation_results: List of recent validation results (most recent first)
        max_results: Maximum number of results to consider

    Returns:
        Health score between 0.0 and 1.0
    """
    if not validation_results:
        return 0.0

    # Consider only recent results
    recent_results = validation_results[:max_results]

    # Calculate success rate
    success_count = sum(1 for r in recent_results if r.success)
    success_rate = success_count / len(recent_results)

    # Calculate average response time factor (lower is better)
    response_times = [r.response_time_ms for r in recent_results if r.response_time_ms is not None]

    if response_times:
        avg_response_time = sum(response_times) / len(response_times)
        # Normalize response time: <1000ms = 1.0, >5000ms = 0.0
        response_time_score = max(0.0, min(1.0, 1.0 - (avg_response_time - 1000) / 4000))
    else:
        response_time_score = 0.5  # neutral

    # Weighted score: 80% success rate, 20% response time
    health_score = (success_rate * 0.8) + (response_time_score * 0.2)

    return round(health_score, 3)


def mark_inactive_feeds(
    feed_sources: list[FeedSource],
    validation_history: dict[str, list[FeedValidationResult]],
    inactive_threshold_days: int = 30,
) -> list[str]:
    """Mark feeds as inactive if they haven't had a successful validation in N days.

    Args:
        feed_sources: List of feed sources to check
        validation_history: Dict mapping feed_source_id to validation results
        inactive_threshold_days: Days without success before marking inactive

    Returns:
        List of feed source IDs marked as inactive
    """
    cutoff_date = datetime.now() - timedelta(days=inactive_threshold_days)
    marked_inactive = []

    for feed in feed_sources:
        history = validation_history.get(feed.id, [])

        if not history:
            # No validation history, skip
            continue

        # Check if any recent validation was successful
        recent_success = any(
            result.success and result.validated_at >= cutoff_date for result in history
        )

        if not recent_success:
            feed.is_active = False
            marked_inactive.append(feed.id)
            logger.warning(
                f"Marked feed {feed.id} as inactive (no success in {inactive_threshold_days} days)"
            )

    return marked_inactive

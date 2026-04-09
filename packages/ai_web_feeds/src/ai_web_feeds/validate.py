"""ai_web_feeds.validate -- Validate feed data against schemas and URLs"""

import asyncio
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import feedparser
import httpx
import jsonschema
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential
from tqdm.asyncio import tqdm as async_tqdm

from ai_web_feeds.load import canonicalize_catalog_source
from ai_web_feeds.models import CurationStatus, FeedSource, FeedValidationResult


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

    canonical_ids: list[str] = []

    # Check for required fields using the canonical source contract
    for i, source in enumerate(sources):
        if not isinstance(source, dict):
            error_msg = f"Source at index {i} must be an object"
            logger.error(error_msg)
            result.add_error(error_msg)
            continue

        try:
            canonical_source = canonicalize_catalog_source(source)
        except ValueError as exc:
            error_msg = f"Source at index {i} invalid: {exc}"
            logger.error(error_msg)
            result.add_error(error_msg)
            continue

        canonical_ids.append(canonical_source["id"])

        if not canonical_source.get("topics"):
            error_msg = f"Source '{canonical_source['id']}' missing required field: topics"
            logger.error(error_msg)
            result.add_error(error_msg)

    duplicates = [
        source_id for source_id in set(canonical_ids) if canonical_ids.count(source_id) > 1
    ]
    if duplicates:
        error_msg = f"Duplicate canonical IDs found: {', '.join(sorted(duplicates))}"
        logger.error(error_msg)
        result.add_error(error_msg)
    else:
        logger.debug("No duplicate canonical IDs found")

    if result.valid:
        logger.info("All validations passed!")

    return result


def validate_topics(  # noqa: PLR0912
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
    raw_topics = data.get("topics", [])
    topics = raw_topics if isinstance(raw_topics, list) else []
    logger.info(f"Validating {len(topics)} topics")

    # Check for duplicate IDs
    ids = [t.get("id") for t in topics if isinstance(t, dict) and t.get("id")]
    duplicates = [id for id in set(ids) if ids.count(id) > 1]

    if duplicates:
        error_msg = f"Duplicate topic IDs found: {', '.join(duplicates)}"
        logger.error(error_msg)
        result.add_error(error_msg)

    valid_ids = set(ids)
    alias_owners: dict[str, set[str]] = {}
    relation_fields = (
        "depends_on",
        "implements",
        "influences",
        "contrasts_with",
        "same_as",
        "related_to",
    )

    for topic in topics:
        if not isinstance(topic, dict):
            result.add_error("Topic entries must be objects")
            continue

        topic_id = topic.get("id", "<unknown>")

        for parent in topic.get("parents", []):
            if parent not in valid_ids:
                error_msg = f"Topic '{topic_id}' references unknown parent '{parent}'"
                logger.error(error_msg)
                result.add_error(error_msg)

        relations = topic.get("relations") or {}
        for relation_name in relation_fields:
            for related_id in relations.get(relation_name, []):
                if related_id not in valid_ids:
                    error_msg = (
                        f"Topic '{topic_id}' references unknown {relation_name} target "
                        f"'{related_id}'"
                    )
                    logger.error(error_msg)
                    result.add_error(error_msg)

        for alias in topic.get("aliases", []):
            normalized_alias = alias.strip().lower()
            if normalized_alias:
                alias_owners.setdefault(normalized_alias, set()).add(topic_id)

    duplicate_aliases = {alias: owners for alias, owners in alias_owners.items() if len(owners) > 1}
    for alias, owners in sorted(duplicate_aliases.items()):
        error_msg = f"Alias '{alias}' is assigned to multiple topics: {', '.join(sorted(owners))}"
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
            has_parse_error = bool(getattr(parsed_feed, "bozo", False))
            bozo_exception = getattr(parsed_feed, "bozo_exception", None)

            # Check if feed is valid
            if has_parse_error:
                result["error_message"] = f"Feed parse error: {bozo_exception}"

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
            has_feed_title = bool(parsed_feed.get("feed", {}).get("title"))

            # Consider feeds valid when they have entries, or when they have valid metadata
            # without parser errors.
            if result["entry_count"] > 0 or (has_feed_title and not has_parse_error):
                result["success"] = True
                result["error_message"] = None
            elif not has_parse_error:
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
            is_valid=False,
            is_accessible=False,
            schema_valid=False,
            format_valid=False,
            has_required_fields=False,
            schema_errors=["No feed or site URL provided"],
            warnings=["No feed or site URL provided"],
            validation_report={"error_message": "No feed or site URL provided"},
            validated_at=datetime.now(),
        )

    # Validate URL
    result_dict = await validate_feed_url(url_to_validate)

    # Convert to FeedValidationResult model
    return FeedValidationResult(
        feed_source_id=feed_source.id,
        is_valid=result_dict["success"],
        is_accessible=result_dict["status_code"] == 200,
        schema_valid=result_dict["success"],
        format_valid=result_dict["feed_format"] != "unknown",
        has_required_fields=result_dict["success"],
        has_items=result_dict["entry_count"] > 0,
        item_count=result_dict["entry_count"],
        http_status=result_dict["status_code"],
        response_time_ms=result_dict["response_time_ms"],
        schema_errors=[result_dict["error_message"]] if result_dict["error_message"] else [],
        warnings=[result_dict["error_message"]] if result_dict["error_message"] else [],
        validation_report=result_dict,
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
    success_count = sum(1 for r in recent_results if r.is_valid)
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
            result.is_valid and result.validated_at >= cutoff_date for result in history
        )

        if not recent_success:
            feed.curation_status = CurationStatus.INACTIVE
            marked_inactive.append(feed.id)
            logger.warning(
                f"Marked feed {feed.id} as inactive (no success in {inactive_threshold_days} days)"
            )

    return marked_inactive

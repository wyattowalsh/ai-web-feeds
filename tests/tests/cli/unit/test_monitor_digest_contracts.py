"""Regression tests for monitor digest CLI contract changes."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from ai_web_feeds.cli.commands.monitor import app
from typer.testing import CliRunner

runner = CliRunner()


def test_status_reports_configuration_with_database_override():
    """status should accept --database and avoid claiming live process state."""
    with patch("ai_web_feeds.cli.commands.monitor.get_settings") as get_settings:
        get_settings.return_value = SimpleNamespace(
            phase3b=SimpleNamespace(
                feed_poll_interval_min=15,
                trending_update_interval_hours=1,
            )
        )
        result = runner.invoke(
            app,
            ["status", "--database", "sqlite:///custom.db"],
        )

    normalized_output = " ".join(result.stdout.split())
    assert result.exit_code == 0
    assert "Cross-process runtime detection is not implemented" in normalized_output
    assert "Configured Jobs" in normalized_output
    assert "custom.db" in normalized_output


def test_subscribe_digest_does_not_require_is_active_field():
    """subscribe-digest should create EmailDigest without removed is_active field."""
    mock_db = MagicMock()
    mock_db.create_email_digest.return_value = SimpleNamespace(
        next_send_at=datetime.now(UTC) + timedelta(days=1)
    )

    with patch("ai_web_feeds.cli.commands.monitor.DatabaseManager", return_value=mock_db):
        result = runner.invoke(
            app,
            [
                "subscribe-digest",
                "user-1",
                "user@example.com",
                "--schedule",
                "daily",
            ],
        )

    assert result.exit_code == 0
    created_digest = mock_db.create_email_digest.call_args[0][0]
    assert created_digest.unsubscribed_at is None
    assert created_digest.schedule_cron == "0 9 * * *"


def test_subscribe_digest_rejects_invalid_timezone_before_write():
    """subscribe-digest should fail fast on invalid timezone values."""
    mock_db = MagicMock()

    with patch("ai_web_feeds.cli.commands.monitor.DatabaseManager", return_value=mock_db):
        result = runner.invoke(
            app,
            [
                "subscribe-digest",
                "user-1",
                "user@example.com",
                "--timezone",
                "Mars/Olympus",
            ],
        )

    assert result.exit_code == 2
    assert "Invalid digest configuration" in result.stdout
    mock_db.create_email_digest.assert_not_called()


def test_unsubscribe_digest_sets_unsubscribed_at_only():
    """unsubscribe-digest should set unsubscribed_at and not rely on removed is_active."""
    digest = SimpleNamespace(unsubscribed_at=None)
    mock_db = MagicMock()
    mock_db.get_email_digest.return_value = digest

    with patch("ai_web_feeds.cli.commands.monitor.DatabaseManager", return_value=mock_db):
        result = runner.invoke(app, ["unsubscribe-digest", "7"])

    assert result.exit_code == 0
    assert digest.unsubscribed_at is not None
    mock_db.update_email_digest.assert_called_once_with(digest)


def test_unsubscribe_digest_missing_subscription_exits_validation():
    """unsubscribe-digest should keep the validation exit code for missing rows."""
    mock_db = MagicMock()
    mock_db.get_email_digest.return_value = None

    with patch("ai_web_feeds.cli.commands.monitor.DatabaseManager", return_value=mock_db):
        result = runner.invoke(app, ["unsubscribe-digest", "7"])

    assert result.exit_code == 2
    assert "Digest 7 not found" in result.stdout


def test_list_digests_uses_unsubscribed_at_for_status():
    """list-digests should derive active/inactive from unsubscribed_at."""
    active = SimpleNamespace(
        id=1,
        email="active@example.com",
        schedule_type="daily",
        next_send_at=datetime.now(UTC),
        unsubscribed_at=None,
    )
    inactive = SimpleNamespace(
        id=2,
        email="inactive@example.com",
        schedule_type="weekly",
        next_send_at=datetime.now(UTC),
        unsubscribed_at=datetime.now(UTC),
    )
    mock_db = MagicMock()
    mock_db.get_user_digests.return_value = [active, inactive]

    with patch("ai_web_feeds.cli.commands.monitor.DatabaseManager", return_value=mock_db):
        result = runner.invoke(app, ["list-digests", "user-1"])

    assert result.exit_code == 0
    assert "Active" in result.stdout
    assert "Inactive" in result.stdout

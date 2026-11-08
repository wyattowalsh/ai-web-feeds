"""Characterization tests for the test-suite CLI.

The command shells out to ``uv run pytest``. The runner is mocked so these
tests cannot re-enter the suite.
"""

from __future__ import annotations

import importlib
import socket
from pathlib import Path
from typing import Any, NoReturn
from unittest.mock import patch

import pytest
from typer.testing import CliRunner

test_app: Any = vars(importlib.import_module("ai_web_feeds.cli.commands.test"))["app"]

_QUICK_PYTEST_ARGS: list[str] = [
    "pytest",
    "-x",
    "-q",
    "-m",
    "unit and not slow",
    "--no-cov",
    "--tb=short",
]


def _refuse_network(*_args: object, **_kwargs: object) -> NoReturn:
    message = "test CLI opened a network connection"
    raise AssertionError(message)


def _refuse_live_pytest(*_args: object, **_kwargs: object) -> NoReturn:
    message = "test CLI invoked pytest through an unguarded subprocess"
    raise AssertionError(message)


@pytest.mark.unit
def test_test_help_does_not_invoke_pytest() -> None:
    """`--help` lists subcommands and does not shell out to pytest."""
    runner = CliRunner()
    with (
        patch.object(socket, "create_connection", side_effect=_refuse_network),
        patch.object(socket, "getaddrinfo", side_effect=_refuse_network),
        patch(
            "ai_web_feeds.cli.commands.test.subprocess.run",
            side_effect=_refuse_live_pytest,
        ) as subprocess_run,
        patch("ai_web_feeds.cli.commands.test.run_uv_command") as run_uv_command,
        patch("ai_web_feeds.cli.commands.test.get_tests_dir") as get_tests_dir,
    ):
        result = runner.invoke(test_app, ["--help"])

    assert result.exit_code == 0, result.output
    assert result.exception is None
    assert "Run test suite" in result.output
    for command_name in (
        "all",
        "unit",
        "integration",
        "e2e",
        "coverage",
        "quick",
        "file",
        "markers",
    ):
        assert command_name in result.output
    run_uv_command.assert_not_called()
    subprocess_run.assert_not_called()
    get_tests_dir.assert_not_called()


@pytest.mark.unit
def test_test_quick_happy_path_is_guarded(tmp_path: Path) -> None:
    """A passing quick run is reported only through the mocked pytest runner."""
    runner = CliRunner()
    with (
        patch.object(socket, "create_connection", side_effect=_refuse_network),
        patch.object(socket, "getaddrinfo", side_effect=_refuse_network),
        patch(
            "ai_web_feeds.cli.commands.test.subprocess.run",
            side_effect=_refuse_live_pytest,
        ) as subprocess_run,
        patch(
            "ai_web_feeds.cli.commands.test.get_tests_dir",
            return_value=tmp_path,
        ),
        patch(
            "ai_web_feeds.cli.commands.test.run_uv_command",
            return_value=0,
        ) as run_uv_command,
    ):
        result = runner.invoke(test_app, ["quick"])

    assert result.exit_code == 0, result.output
    assert result.exception is None
    assert "Running quick tests" in result.output
    assert str(tmp_path) in result.output
    assert "Quick tests passed" in result.output
    run_uv_command.assert_called_once_with(_QUICK_PYTEST_ARGS, cwd=tmp_path)
    invocation = run_uv_command.call_args
    assert invocation is not None
    assert invocation.args[0][0] == "pytest"
    subprocess_run.assert_not_called()

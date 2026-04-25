"""Run repository tests with ``uv``."""

from __future__ import annotations

import os
import shutil
import subprocess  # nosec B404 - used only to exec repo-controlled uv commands without a shell
import sys
from pathlib import Path

import typer
from loguru import logger

from ai_web_feeds.cli.support import CommandResult, ExitCode, console, render_result

app = typer.Typer(help="Run the test suite", invoke_without_command=True)
cli = app


def get_project_root() -> Path:
    """Get the repository root."""
    current = Path(__file__).resolve()
    for parent in current.parents:
        pyproject = parent / "pyproject.toml"
        if pyproject.exists():
            try:
                import tomllib

                with pyproject.open("rb") as f:
                    data = tomllib.load(f)
                    if (
                        "tool" in data
                        and "uv" in data["tool"]
                        and "workspace" in data["tool"]["uv"]
                    ):
                        return parent
            except (OSError, tomllib.TOMLDecodeError):
                continue
        # Fallback: if we find a tests directory at this level
        if (parent / "tests").exists() and (parent / "packages").exists():
            return parent
    return Path.cwd()


def get_tests_dir() -> Path:
    """Get the tests workspace directory."""
    tests_dir = get_project_root() / "tests"
    if not tests_dir.exists():
        msg = f"Tests directory not found at {tests_dir}"
        raise RuntimeError(msg)
    return tests_dir


def resolve_uv_executable() -> str:
    """Resolve the uv executable path."""
    uv_executable = shutil.which("uv")
    if uv_executable is None:
        raise RuntimeError("uv executable not found on PATH")
    return uv_executable


def run_uv_command(args: list[str], cwd: Path | None = None) -> int:
    """Run a uv command and return exit code."""
    uv_executable = resolve_uv_executable()
    cmd = [uv_executable, "run", *args]
    logger.debug(f"Running: {' '.join(cmd)}")
    logger.debug(f"Working directory: {cwd or Path.cwd()}")
    env = os.environ.copy()
    completed = subprocess.run(cmd, cwd=cwd, env=env, check=False)  # nosec B603
    return completed.returncode


@app.command("all")
def test_all(
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Verbose output"),
    coverage: bool = typer.Option(False, "--coverage", "-c", help="Generate coverage report"),
    parallel: bool = typer.Option(False, "--parallel", "-p", help="Run tests in parallel"),
) -> None:
    """Run all tests."""
    tests_dir = get_tests_dir()
    args = ["pytest", "-v" if verbose else "-q"]
    if coverage:
        args.extend(["--cov=ai_web_feeds", "--cov-report=html", "--cov-report=term-missing"])
    if parallel:
        args.extend(["-n", "auto"])

    console.print(f"🧪 Running all tests from {tests_dir}")
    exit_code = run_uv_command(args, cwd=tests_dir)
    if exit_code == 0 and coverage:
        console.print(f"📊 Coverage report: {tests_dir / 'reports' / 'coverage' / 'index.html'}")
    _exit_with_status(exit_code, "All tests passed", "Some tests failed")


@app.command("unit")
def test_unit(
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Verbose output"),
    fast: bool = typer.Option(False, "--fast", "-f", help="Skip slow tests"),
) -> None:
    """Run unit tests only."""
    tests_dir = get_tests_dir()
    marker = "unit and not slow" if fast else "unit"
    exit_code = run_uv_command(["pytest", "-v" if verbose else "-q", "-m", marker], cwd=tests_dir)
    _exit_with_status(exit_code, "Unit tests passed", "Unit tests failed")


@app.command("integration")
def test_integration(
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Verbose output"),
) -> None:
    """Run integration tests."""
    tests_dir = get_tests_dir()
    exit_code = run_uv_command(
        ["pytest", "-v" if verbose else "-q", "-m", "integration"], cwd=tests_dir
    )
    _exit_with_status(exit_code, "Integration tests passed", "Integration tests failed")


@app.command("e2e")
def test_e2e(
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Verbose output"),
) -> None:
    """Run end-to-end tests."""
    tests_dir = get_tests_dir()
    exit_code = run_uv_command(["pytest", "-v" if verbose else "-q", "-m", "e2e"], cwd=tests_dir)
    _exit_with_status(exit_code, "E2E tests passed", "E2E tests failed")


@app.command("coverage")
def test_coverage(
    html: bool = typer.Option(True, "--html/--no-html", help="Generate HTML report"),
    open_browser: bool = typer.Option(
        False,
        "--open",
        "-o",
        help="Open the coverage report in a browser",
    ),
) -> None:
    """Run tests with coverage reporting."""
    tests_dir = get_tests_dir()
    args = ["pytest", "-v", "--cov=ai_web_feeds", "--cov-report=term-missing"]
    if html:
        args.append("--cov-report=html")

    exit_code = run_uv_command(args, cwd=tests_dir)
    if exit_code == 0 and html:
        coverage_path = tests_dir / "reports" / "coverage" / "index.html"
        console.print(f"📊 Coverage report: {coverage_path}")
        if open_browser and coverage_path.exists():
            import webbrowser

            webbrowser.open(str(coverage_path))
    _exit_with_status(exit_code, "Tests passed with coverage", "Tests failed during coverage run")


@app.command("watch")
def test_watch() -> None:
    """Run tests in watch mode."""
    tests_dir = get_tests_dir()
    console.print(f"👀 Running tests in watch mode from {tests_dir}")
    console.print("Press Ctrl+C to stop")
    try:
        exit_code = run_uv_command(["pytest-watch", "--", "-v"], cwd=tests_dir)
    except KeyboardInterrupt:
        raise typer.Exit(code=int(ExitCode.OK)) from None
    raise typer.Exit(code=exit_code)


@app.command("quick")
def test_quick() -> None:
    """Run the fast unit-test subset."""
    tests_dir = get_tests_dir()
    args = ["pytest", "-x", "-q", "-m", "unit and not slow", "--no-cov", "--tb=short"]
    exit_code = run_uv_command(args, cwd=tests_dir)
    _exit_with_status(exit_code, "Quick tests passed", "Quick tests failed")


@app.command("file")
def test_file(
    file_path: str = typer.Argument(..., help="Path to the test file or directory"),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Verbose output"),
    keywords: str | None = typer.Option(
        None, "--keywords", "-k", help="Run tests matching keywords"
    ),
) -> None:
    """Run a specific test file or directory."""
    tests_dir = get_tests_dir()
    args = ["pytest", "-v" if verbose else "-q", file_path]
    if keywords:
        args.extend(["-k", keywords])
    exit_code = run_uv_command(args, cwd=tests_dir)
    _exit_with_status(exit_code, "Selected tests passed", "Selected tests failed")


@app.command("debug")
def test_debug(
    file_path: str | None = typer.Argument(None, help="Path to test file"),
):
    """Run tests in debug mode (with pdb)."""
    tests_dir = get_tests_dir()
    args = ["pytest", "-vv", "-s", "--pdb", "-x"]
    if file_path:
        args.append(file_path)
    exit_code = run_uv_command(args, cwd=tests_dir)
    raise typer.Exit(code=exit_code)


@app.command("markers")
def list_markers() -> None:
    """List available test markers."""
    tests_dir = get_tests_dir()
    console.print("📋 Available test markers:")
    exit_code = run_uv_command(["pytest", "--markers"], cwd=tests_dir)
    raise typer.Exit(code=exit_code)


if __name__ == "__main__":
    app()

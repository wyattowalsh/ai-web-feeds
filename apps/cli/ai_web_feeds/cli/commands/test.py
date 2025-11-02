"""ai_web_feeds.cli.commands.test -- Run test suite with uv

This command provides a convenient way to run tests using uv.
"""

import subprocess
import sys
from pathlib import Path
from typing import Optional

import typer
from loguru import logger

app = typer.Typer(help="Run test suite")


def get_project_root() -> Path:
    """Get the project root directory (workspace root)."""
    # Start from this file and go up to find the workspace root
    current = Path(__file__).resolve()
    for parent in current.parents:
        # Look for workspace root marker (uv.workspace)
        pyproject = parent / "pyproject.toml"
        if pyproject.exists():
            try:
                import tomllib

                with open(pyproject, "rb") as f:
                    data = tomllib.load(f)
                    if (
                        "tool" in data
                        and "uv" in data["tool"]
                        and "workspace" in data["tool"]["uv"]
                    ):
                        return parent
            except Exception:
                pass
        # Fallback: if we find a tests directory at this level
        if (parent / "tests").exists() and (parent / "packages").exists():
            return parent
    return Path.cwd()


def get_tests_dir() -> Path:
    """Get the tests directory."""
    root = get_project_root()
    tests_dir = root / "tests"
    if not tests_dir.exists():
        raise RuntimeError(f"Tests directory not found at {tests_dir}")
    return tests_dir


def run_uv_command(args: list[str], cwd: Optional[Path] = None) -> int:
    """Run a uv command and return exit code."""
    cmd = ["uv", "run"] + args
    logger.debug(f"Running: {' '.join(cmd)}")
    logger.debug(f"Working directory: {cwd or Path.cwd()}")

    result = subprocess.run(
        cmd,
        cwd=cwd,
        stdout=sys.stdout,
        stderr=sys.stderr,
    )
    return result.returncode


@app.command("all")
def test_all(
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Verbose output"),
    coverage: bool = typer.Option(False, "--coverage", "-c", help="Generate coverage report"),
    parallel: bool = typer.Option(False, "--parallel", "-p", help="Run tests in parallel"),
):
    """Run all tests."""
    tests_dir = get_tests_dir()

    args = ["pytest", "-v" if verbose else "-q"]

    if coverage:
        args.extend(
            [
                "--cov=ai_web_feeds",
                "--cov-report=html",
                "--cov-report=term-missing",
            ]
        )

    if parallel:
        args.extend(["-n", "auto"])

    typer.echo(f"🧪 Running all tests from {tests_dir}")
    exit_code = run_uv_command(args, cwd=tests_dir)

    if exit_code == 0:
        typer.secho("✅ All tests passed!", fg=typer.colors.GREEN, bold=True)
        if coverage:
            coverage_path = tests_dir / "reports" / "coverage" / "index.html"
            typer.echo(f"📊 Coverage report: {coverage_path}")
    else:
        typer.secho("❌ Some tests failed!", fg=typer.colors.RED, bold=True)

    sys.exit(exit_code)


@app.command("unit")
def test_unit(
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Verbose output"),
    fast: bool = typer.Option(False, "--fast", "-f", help="Skip slow tests"),
):
    """Run unit tests only."""
    tests_dir = get_tests_dir()

    marker = "unit and not slow" if fast else "unit"
    args = ["pytest", "-v" if verbose else "-q", "-m", marker]

    typer.echo(f"⚡ Running unit tests from {tests_dir}")
    exit_code = run_uv_command(args, cwd=tests_dir)

    if exit_code == 0:
        typer.secho("✅ Unit tests passed!", fg=typer.colors.GREEN, bold=True)
    else:
        typer.secho("❌ Unit tests failed!", fg=typer.colors.RED, bold=True)

    sys.exit(exit_code)


@app.command("integration")
def test_integration(
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Verbose output"),
):
    """Run integration tests."""
    tests_dir = get_tests_dir()

    args = ["pytest", "-v" if verbose else "-q", "-m", "integration"]

    typer.echo(f"🔗 Running integration tests from {tests_dir}")
    exit_code = run_uv_command(args, cwd=tests_dir)

    if exit_code == 0:
        typer.secho("✅ Integration tests passed!", fg=typer.colors.GREEN, bold=True)
    else:
        typer.secho("❌ Integration tests failed!", fg=typer.colors.RED, bold=True)

    sys.exit(exit_code)


@app.command("e2e")
def test_e2e(
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Verbose output"),
):
    """Run end-to-end tests."""
    tests_dir = get_tests_dir()

    args = ["pytest", "-v" if verbose else "-q", "-m", "e2e"]

    typer.echo(f"🎯 Running E2E tests from {tests_dir}")
    exit_code = run_uv_command(args, cwd=tests_dir)

    if exit_code == 0:
        typer.secho("✅ E2E tests passed!", fg=typer.colors.GREEN, bold=True)
    else:
        typer.secho("❌ E2E tests failed!", fg=typer.colors.RED, bold=True)

    sys.exit(exit_code)


@app.command("coverage")
def test_coverage(
    html: bool = typer.Option(True, "--html/--no-html", help="Generate HTML report"),
    open_browser: bool = typer.Option(
        False, "--open", "-o", help="Open coverage report in browser"
    ),
):
    """Run tests with coverage report."""
    tests_dir = get_tests_dir()

    args = ["pytest", "-v", "--cov=ai_web_feeds", "--cov-report=term-missing"]

    if html:
        args.append("--cov-report=html")

    typer.echo(f"📊 Running tests with coverage from {tests_dir}")
    exit_code = run_uv_command(args, cwd=tests_dir)

    if exit_code == 0:
        typer.secho("✅ Tests passed!", fg=typer.colors.GREEN, bold=True)

        if html:
            coverage_path = tests_dir / "reports" / "coverage" / "index.html"
            typer.echo(f"📊 Coverage report: {coverage_path}")

            if open_browser and coverage_path.exists():
                import webbrowser

                webbrowser.open(str(coverage_path))
    else:
        typer.secho("❌ Tests failed!", fg=typer.colors.RED, bold=True)

    sys.exit(exit_code)


@app.command("watch")
def test_watch():
    """Run tests in watch mode (re-run on file changes)."""
    tests_dir = get_tests_dir()

    args = ["pytest-watch", "--", "-v"]

    typer.echo(f"👀 Running tests in watch mode from {tests_dir}")
    typer.echo("Press Ctrl+C to stop")

    try:
        exit_code = run_uv_command(args, cwd=tests_dir)
        sys.exit(exit_code)
    except KeyboardInterrupt:
        typer.echo("\n⏹️  Stopped watching")
        sys.exit(0)


@app.command("quick")
def test_quick():
    """Quick test run (unit tests, fail fast, no coverage)."""
    tests_dir = get_tests_dir()

    args = ["pytest", "-x", "-q", "-m", "unit and not slow", "--no-cov", "--tb=short"]

    typer.echo(f"🚀 Running quick tests from {tests_dir}")
    exit_code = run_uv_command(args, cwd=tests_dir)

    if exit_code == 0:
        typer.secho("✅ Quick tests passed!", fg=typer.colors.GREEN, bold=True)
    else:
        typer.secho("❌ Quick tests failed!", fg=typer.colors.RED, bold=True)

    sys.exit(exit_code)


@app.command("file")
def test_file(
    file_path: str = typer.Argument(..., help="Path to test file or directory"),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Verbose output"),
    keywords: Optional[str] = typer.Option(
        None, "--keywords", "-k", help="Run tests matching keywords"
    ),
):
    """Run specific test file or directory."""
    tests_dir = get_tests_dir()

    args = ["pytest", "-v" if verbose else "-q", file_path]

    if keywords:
        args.extend(["-k", keywords])

    typer.echo(f"🎯 Running tests in {file_path}")
    exit_code = run_uv_command(args, cwd=tests_dir)

    if exit_code == 0:
        typer.secho("✅ Tests passed!", fg=typer.colors.GREEN, bold=True)
    else:
        typer.secho("❌ Tests failed!", fg=typer.colors.RED, bold=True)

    sys.exit(exit_code)


@app.command("debug")
def test_debug(
    file_path: Optional[str] = typer.Argument(None, help="Path to test file"),
):
    """Run tests in debug mode (with pdb)."""
    tests_dir = get_tests_dir()

    args = ["pytest", "-vv", "-s", "--pdb", "-x"]

    if file_path:
        args.append(file_path)

    typer.echo("🐛 Running tests in debug mode")
    exit_code = run_uv_command(args, cwd=tests_dir)

    sys.exit(exit_code)


@app.command("markers")
def list_markers():
    """List available test markers."""
    tests_dir = get_tests_dir()

    args = ["pytest", "--markers"]

    typer.echo("📋 Available test markers:")
    run_uv_command(args, cwd=tests_dir)


@app.callback()
def callback():
    """Run tests using uv and pytest."""
    pass


if __name__ == "__main__":
    app()

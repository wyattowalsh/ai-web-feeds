# CLI Application - Agent Instructions

> **Component**: Command-Line Interface\
> **Location**: `apps/cli/`\
> **Parent**: [Root AGENTS.md](../../AGENTS.md)

## ⚠️ CRITICAL: Documentation Policy - READ THIS FIRST!

**🚫 ABSOLUTE RULE: NO `.md` FILES IN THIS PACKAGE FOR DOCUMENTATION**

**If you need to document CLI usage, commands, or features:**

1. ✅ Create `.mdx` file in `../../apps/web/content/docs/`
   - CLI Guide → `apps/web/content/docs/development/cli.mdx`
   - Workflows → `apps/web/content/docs/development/cli-workflows.mdx`
   - Tutorials → `apps/web/content/docs/guides/*.mdx`
1. ✅ Add frontmatter: `title` and `description`
1. ✅ Update `../../apps/web/content/docs/meta.json`
1. ❌ NEVER create `.md` files here!

**❌ FORBIDDEN FILES IN THIS PACKAGE:**

```
❌ apps/cli/USER_GUIDE.md
❌ apps/cli/COMMANDS.md
❌ apps/cli/QUICKSTART.md
❌ apps/cli/TUTORIAL.md
❌ apps/cli/CLI_REFERENCE.md
❌ ANY other .md file except AGENTS.md and README.md
```

**✅ ONLY ALLOWED IN THIS PACKAGE:**

- Python CLI code: `ai_web_feeds/cli/**/*.py`
- Configuration: `pyproject.toml`
- This file: `AGENTS.md`
- Basic readme: `README.md` (brief, points to web docs)

**NO EXCEPTIONS!**

## 📍 Essential Links

- **Full Documentation**:
  [llms-full.txt#cli](https://aiwebfeeds.vercel.app/llms-full.txt#cli)
- **CLI User Guide**:
  [aiwebfeeds.vercel.app/docs/development/cli](https://aiwebfeeds.vercel.app/docs/development/cli)
- **Root Instructions**: [../../AGENTS.md](../../AGENTS.md)
- **Core Package**:
  [../../packages/ai_web_feeds/AGENTS.md](../../packages/ai_web_feeds/AGENTS.md)
- **Testing**: [../../tests/AGENTS.md](../../tests/AGENTS.md)

______________________________________________________________________

## 🎯 Purpose

Typer-based CLI exposing core functionality:

- Feed fetching/parsing (wraps `fetcher.py`)
- Analytics display (uses `analytics.py`)
- Topic taxonomy management (`topics.yaml`)
- AI enrichment workflows (`feeds.enriched.yaml`)
- OPML import/export
- Feed validation
- Data export (JSON/CSV/Markdown)

**Stack**: Typer 0.15+, Rich 13+, Python 3.13+

**Data Access**: YAML/JSON feeds, topic graphs, enriched metadata, SQLite cache

______________________________________________________________________

## 🏗️ Architecture

```
apps/cli/ai_web_feeds/cli/
├── __init__.py         # Main Typer app + process/load + registrations
└── commands/           # Command modules
    ├── analytics.py    # summary/trending/velocity/snapshot/export
    ├── corpus.py       # export/refresh article corpus
    ├── enrich.py       # all/one enrichment
    ├── export.py       # json/opml/all/csv
    ├── fetch.py        # one/all feed polling
    ├── monitor.py      # start/status/follow/digests
    ├── nlp.py          # quality/entities/sentiment/topics
    ├── opml.py         # all/categorized/filtered
    ├── recommend.py    # get/track/weights
    ├── search.py       # query/autocomplete/embeddings
    ├── stats.py        # show statistics
    ├── test.py         # all/unit/integration/coverage
    ├── validate.py     # feeds/topics/references/all/http
    └── visualize.py    # mermaid/json/stats taxonomy exports
```

**Entry point**: `pyproject.toml` → `ai-web-feeds` command

**See**: [llms-full.txt#cli](https://aiwebfeeds.vercel.app/llms-full.txt#cli) for
command reference

______________________________________________________________________

## 📐 Development Rules

### 1. Command Structure

```python
# ✅ Standard pattern
from typer import Typer
from rich.console import Console

app = Typer()
console = Console()


@app.command()
def fetch(
    url: str = Argument(..., help="Feed URL"),
    verbose: bool = Option(False, "--verbose", "-v"),
) -> None:
    """Fetch and display a feed."""
    ...
```

### 2. Rich Output

```python
# Use Rich for all UI
from rich.table import Table
from rich.progress import track

table = Table(title="Feeds")
for item in track(items, description="Processing..."):
    table.add_row(...)
console.print(table)
```

### 3. Error Handling

```python
# Always use Typer's exception handling
from typer import Exit

if not feed:
    console.print("[red]Error: Feed not found[/red]")
    raise Exit(code=1)
```

______________________________________________________________________

## 🧪 Testing

**Location**: `tests/cli/`

```bash
# Run CLI tests
cd ../../tests && uv run pytest tests/cli/ -v

# Test specific command
uv run pytest tests/cli/unit/test_commands.py -v
```

**Patterns**:

- Use `CliRunner` from Typer for command testing
- Mock core package imports
- Verify Rich output formatting
- Test error exit codes

**See**: [../../tests/AGENTS.md#cli-testing](../../tests/AGENTS.md)

______________________________________________________________________

## 🔄 Common Tasks

### Adding a New Command

1. Create `commands/new_command.py`
1. Define command with Typer decorators
1. Register in `__init__.py`: `app.add_typer(new_command.app)`
1. Add tests in `tests/tests/cli/unit/test_commands.py` (or a new `test_<command>.py` alongside it)
1. Document in `apps/web/content/docs/cli/`

### Adding Command Options

```python
from typer import Option


@app.command()
def fetch(
    url: str,
    timeout: int = Option(30, help="Request timeout"),
    format: str = Option("table", help="Output format"),
): ...
```

### Rich UI Components

- **Tables**: `from rich.table import Table`
- **Progress**: `from rich.progress import track`
- **Panels**: `from rich.panel import Panel`
- **Markdown**: `from rich.markdown import Markdown`

______________________________________________________________________

## 🚨 Critical Patterns

### DO

✅ Use Rich for all terminal output\
✅ Add help text to all commands/options\
✅ Handle errors with proper exit codes\
✅ Test commands with `CliRunner`\
✅ Import from core package (not re-implement)\
✅ Add progress bars for long operations

### DON'T

❌ Use `print()` (use `console.print()`)\
❌ Re-implement core package logic\
❌ Skip command help text\
❌ Use hard-coded paths\
❌ Forget to handle `KeyboardInterrupt`\
❌ Add commands without tests

______________________________________________________________________

## 📚 Reference

**Command reference**:
[llms-full.txt#cli-commands](https://aiwebfeeds.vercel.app/llms-full.txt#cli-commands)\
**Typer docs**: [typer.tiangolo.com](https://typer.tiangolo.com)\
**Rich docs**: [rich.readthedocs.io](https://rich.readthedocs.io)\
**Testing patterns**: [../../tests/AGENTS.md](../../tests/AGENTS.md#cli-testing)

______________________________________________________________________

*Updated: October 15, 2025 · Version: 0.1.0*

______________________________________________________________________

## 🆕 Recent Updates

### Topic Taxonomy Support (October 2025)

The CLI validates `data/topics.yaml` through `ai-web-feeds validate topics` and exposes
graph exports through `ai-web-feeds visualize`.

### Enrichment Workflow (October 2025)

Enhanced `enrich` command now supports:

- AI-powered topic inference from feed content
- Semantic embedding generation
- Batch processing with progress tracking
- Output to `data/feeds.enriched.yaml`

______________________________________________________________________

## 📦 Command Reference

### Main CLI Structure

```python
from ai_web_feeds.cli.commands import (
    analytics,
    corpus,
    enrich as enrich_commands,
    export as export_commands,
    fetch,
    monitor,
    nlp,
    opml,
    recommend,
    search,
    stats,
    test,
    validate as validate_commands,
    visualize,
)

app.add_typer(fetch.app, name="fetch")
app.add_typer(enrich.app, name="enrich")
app.add_typer(export.app, name="export")
app.add_typer(analytics.app, name="analytics")
app.add_typer(stats.app, name="stats")
app.add_typer(validate.app, name="validate")
app.add_typer(opml.app, name="opml")
app.add_typer(test.app, name="test")
app.add_typer(visualize.app, name="visualize")


def main() -> None:
    """CLI entry point."""
    app()


if __name__ == "__main__":
    main()
```

______________________________________________________________________

## 📚 Command Documentation

### `fetch` - Download Feeds

**Purpose**: Fetch and parse RSS/Atom feeds

**Usage**:

```bash
ai-web-feeds fetch one https://example.com/feed.xml --database sqlite:///data/ai-web-feeds.db
ai-web-feeds fetch all --limit 25
ai-web-feeds fetch all --source-type blog --topic machine-learning
```

**Implementation** (`commands/fetch.py`):

```python
import typer
from rich.console import Console
from rich.progress import track
from ai_web_feeds.fetcher import fetch_feed
from ai_web_feeds.storage import FeedStorage
from loguru import logger

app = typer.Typer()
console = Console()


@app.command()
def run(
    url: str = typer.Option(..., "--url", "-u", help="Feed URL to fetch"),
    save: bool = typer.Option(False, "--save", "-s", help="Save to database"),
    timeout: int = typer.Option(30, "--timeout", "-t", help="Request timeout"),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Verbose output"),
) -> None:
    """Fetch and parse an RSS/Atom feed."""

    if verbose:
        logger.remove()
        logger.add(sys.stderr, level="DEBUG")

    console.print(f"[bold blue]Fetching feed from:[/bold blue] {url}")

    try:
        # Fetch feed
        with console.status("[bold green]Downloading..."):
            response = fetch_feed(url, timeout=timeout)

        # Parse feed
        parsed = feedparser.parse(response.text)

        console.print(f"[green]✓[/green] Title: {parsed.feed.title}")
        console.print(f"[green]✓[/green] Entries: {len(parsed.entries)}")

        # Save if requested
        if save:
            storage = FeedStorage()
            feed = Feed(
                url=url, title=parsed.feed.title, description=parsed.feed.description
            )
            storage.add_feed(feed)
            console.print("[green]✓[/green] Saved to database")

    except Exception as e:
        console.print(f"[red]✗[/red] Error: {e}")
        raise typer.Exit(code=1)
```

**Options**:

- `--url, -u`: Feed URL (required)
- `--save, -s`: Save to database
- `--timeout, -t`: Request timeout in seconds (default: 30)
- `--verbose, -v`: Enable verbose logging

______________________________________________________________________

### `analytics` - Display Analytics

**Purpose**: Show feed analytics and insights

**Usage**:

```bash
ai-web-feeds analytics
ai-web-feeds analytics --top 20
ai-web-feeds analytics --export report.json
```

**Implementation** (`commands/analytics.py`):

```python
import typer
from rich.console import Console
from rich.table import Table
from ai_web_feeds.analytics import FeedAnalytics
from ai_web_feeds.storage import FeedStorage

app = typer.Typer()
console = Console()


@app.command()
def run(
    top: int = typer.Option(10, "--top", "-n", help="Number of top feeds to show"),
    export: Optional[str] = typer.Option(None, "--export", "-e", help="Export to file"),
) -> None:
    """Display feed analytics and statistics."""

    storage = FeedStorage()
    analytics = FeedAnalytics(storage)

    # Calculate stats
    with console.status("[bold green]Analyzing feeds..."):
        stats = analytics.calculate_stats()

    # Display summary
    console.print("\n[bold cyan]Feed Statistics Summary[/bold cyan]\n")
    console.print(f"Total Feeds: [bold]{stats.total_feeds}[/bold]")
    console.print(f"Active Feeds: [bold green]{stats.active_feeds}[/bold green]")
    console.print(f"Total Items: [bold]{stats.total_items}[/bold]")
    console.print(f"Items/Feed: [bold]{stats.items_per_feed:.1f}[/bold]")

    # Display top feeds table
    if stats.most_active_feeds:
        table = Table(title=f"\nTop {top} Most Active Feeds")
        table.add_column("Rank", style="cyan")
        table.add_column("Feed Title", style="green")
        table.add_column("Items", justify="right", style="yellow")

        for i, (title, count) in enumerate(stats.most_active_feeds[:top], 1):
            table.add_row(str(i), title, str(count))

        console.print(table)

    # Export if requested
    if export:
        import json

        with open(export, "w") as f:
            json.dump(asdict(stats), f, indent=2, default=str)
        console.print(f"\n[green]✓[/green] Exported to {export}")
```

______________________________________________________________________

### `stats` - Quick Statistics

**Purpose**: Display quick feed statistics

**Usage**:

```bash
ai-web-feeds stats
ai-web-feeds stats --json
```

______________________________________________________________________

### `validate` - Validate Feeds

**Purpose**: Validate feed data and check for issues

**Usage**:

```bash
ai-web-feeds validate feeds
ai-web-feeds validate topics
ai-web-feeds validate all --strict
```

______________________________________________________________________

### `enrich` - AI Enrichment

**Purpose**: Enhance feed data with AI-powered metadata

**Usage**:

```bash
ai-web-feeds enrich one https://example.com/feed.xml
ai-web-feeds enrich all --input data/feeds.yaml --output data/feeds.enriched.yaml
```

______________________________________________________________________

### `export` - Export Feeds

**Purpose**: Export feeds to various formats

**Usage**:

```bash
ai-web-feeds export json --output feeds.json
ai-web-feeds export opml --output feeds.opml
ai-web-feeds export csv --output feeds.csv
```

**Supported Formats**:

- JSON
- OPML
- CSV

______________________________________________________________________

### `opml` - OPML Operations

**Purpose**: Generate OPML feed lists

**Usage**:

```bash
ai-web-feeds opml all --output feeds.opml
ai-web-feeds opml categorized --output feeds.categorized.opml
ai-web-feeds opml filtered feeds.filtered.opml --topic machine-learning
```

______________________________________________________________________

### `test` - CLI Testing

**Purpose**: Test CLI functionality

**Usage**:

```bash
ai-web-feeds test all
ai-web-feeds test unit --fast
ai-web-feeds test coverage --open
```

______________________________________________________________________

## 🛠️ Development Guidelines

### Command Structure

Each command follows this pattern:

```python
import typer
from rich.console import Console
from typing import Optional

app = typer.Typer()
console = Console()


@app.command()
def run(
    # Required arguments
    input_file: str = typer.Argument(..., help="Input file path"),
    # Optional flags
    output: Optional[str] = typer.Option(None, "--output", "-o", help="Output file"),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Verbose output"),
    force: bool = typer.Option(False, "--force", "-f", help="Force operation"),
) -> None:
    """Command description.

    Detailed explanation of what the command does.
    """

    try:
        # Command logic
        console.print("[bold green]Starting...[/bold green]")

        # Use Rich for output
        with console.status("[bold green]Processing..."):
            # Do work
            pass

        console.print("[green]✓[/green] Success!")

    except Exception as e:
        console.print(f"[red]✗[/red] Error: {e}", style="bold red")
        raise typer.Exit(code=1)
```

### Rich UI Patterns

**Progress Bar**:

```python
from rich.progress import track

for item in track(items, description="Processing..."):
    # Process item
    pass
```

**Tables**:

```python
from rich.table import Table

table = Table(title="Results")
table.add_column("Name", style="cyan")
table.add_column("Value", style="green")
table.add_row("Total", "100")
console.print(table)
```

**Status Spinner**:

```python
with console.status("[bold green]Working..."):
    # Long-running operation
    pass
```

**Panels**:

```python
from rich.panel import Panel

console.print(Panel("Important message", title="Notice", border_style="red"))
```

### Error Handling

Always use try/except and exit with proper codes:

```python
try:
    # Command logic
    pass
except FileNotFoundError as e:
    console.print(f"[red]File not found:[/red] {e}")
    raise typer.Exit(code=2)
except Exception as e:
    console.print(f"[red]Unexpected error:[/red] {e}")
    logger.exception("Command failed")
    raise typer.Exit(code=1)
```

**Exit Codes**:

- `0` - Success
- `1` - General error
- `2` - File/resource not found
- `3` - Invalid input
- `4` - Network error

______________________________________________________________________

## 🧪 Testing

### Test Structure

Tests are in `tests/tests/cli/`:

```
tests/tests/cli/
├── unit/
│   └── test_commands.py           # Unit tests for commands
└── integration/
    └── test_cli_integration.py    # Integration tests
```

### Testing Commands

Use `typer.testing.CliRunner`:

```python
import pytest
from typer.testing import CliRunner
from ai_web_feeds.cli import app

runner = CliRunner()


class TestFetchCommand:
    """Tests for fetch command."""

    @pytest.mark.unit
    def test_fetch_success(self, mock_httpx):
        """Test successful feed fetch."""
        result = runner.invoke(app, ["fetch", "--url", "https://example.com/feed.xml"])

        assert result.exit_code == 0
        assert "Success" in result.stdout

    @pytest.mark.unit
    def test_fetch_invalid_url(self):
        """Test fetch with invalid URL."""
        result = runner.invoke(app, ["fetch", "--url", "invalid"])

        assert result.exit_code != 0
        assert "Error" in result.stdout
```

### Running CLI Tests

```bash
cd tests

# All CLI tests
uv run pytest tests/cli/

# Specific test file
uv run pytest tests/cli/unit/test_commands.py -v

# With coverage
uv run pytest tests/cli/ --cov=ai_web_feeds.cli
```

______________________________________________________________________

## 🎯 Common Tasks

### Adding a New Command

1. **Create command file**: `commands/mycommand.py`

```python
import typer
from rich.console import Console

app = typer.Typer()
console = Console()


@app.command()
def run(
    input_file: str = typer.Argument(..., help="Input file"),
    verbose: bool = typer.Option(False, "--verbose", "-v"),
) -> None:
    """My new command description."""
    console.print("[bold green]Running mycommand...[/bold green]")
```

2. **Register in `__init__.py`**:

```python
from ai_web_feeds.cli.commands import mycommand

app.add_typer(mycommand.app, name="mycommand")
```

3. **Add tests**: `tests/tests/cli/unit/test_commands.py`

1. **Test manually**:

```bash
uv run ai-web-feeds mycommand --help
```

### Adding Command Options

```python
# Boolean flags
verbose: bool = typer.Option(False, "--verbose", "-v", help="Verbose output")

# String options with default
output: str = typer.Option("output.txt", "--output", "-o", help="Output file")

# Optional values (None by default)
config: Optional[str] = typer.Option(None, "--config", "-c", help="Config file")

# Required options
api_key: str = typer.Option(..., "--api-key", envvar="API_KEY", help="API key")

# Integer with validation
count: int = typer.Option(10, "--count", "-n", min=1, max=100, help="Item count")

# Enum/Choice
from enum import Enum


class OutputFormat(str, Enum):
    json = "json"
    yaml = "yaml"
    csv = "csv"


format: OutputFormat = typer.Option(
    OutputFormat.json, "--format", "-f", help="Output format"
)
```

______________________________________________________________________

## 🐛 Troubleshooting

### Command Not Found

```bash
# Reinstall CLI
cd apps/cli
uv sync --reinstall

# Verify installation
uv run ai-web-feeds --version
```

### Import Errors

```bash
# Ensure core package is installed
cd packages/ai_web_feeds
uv sync

# Return to CLI and reinstall
cd ../../apps/cli
uv sync
```

### Rich Output Issues

```bash
# Force color output
export FORCE_COLOR=1

# Disable color (for CI/logs)
export NO_COLOR=1
```

______________________________________________________________________

## 📚 Resources

- [Typer Documentation](https://typer.tiangolo.com/)
- [Rich Documentation](https://rich.readthedocs.io/)
- [Click Documentation](https://click.palletsprojects.com/) (Typer is built on Click)

______________________________________________________________________

*Last Updated: October 2025*

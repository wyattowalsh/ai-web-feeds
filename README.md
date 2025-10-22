# AIWebFeeds

***`AIWebFeeds`*** ([wyattowalsh/ai-web-feeds](https://github.com/wyattowalsh/ai-web-feeds)) is the ultimate collection of AI/ML-related feeds from around the web. GitHub Repo, OPML files, Python CLI, FumaDocs nextjs site w/ docs, blog, and more.

## Features

- Curated feed library
  - Organized by multiple categories (e.g., research, news, company blogs, podcasts, newsletters)
  - Deduplication and canonicalization of sources
  - Clear naming and consistent metadata

- OPML import/export
  - One master OPML combining all feeds
  - Per‑category OPML files for selective import
  - Clean titles and folder hierarchy for readers

- Validation and quality checks
  - HTTP reachability and content-type validation
  - RSS/Atom auto-discovery from site URLs when needed
  - Robust retries and backoff for flaky endpoints
  - Basic analytics and summaries (counts by category, validation stats)
  - RSSHub fallback for sites without native feeds (public or self-hosted instances)
  - Docling-based parsing for PDFs/unstructured documents linked from feeds (optional)

- Developer-friendly CLI (Typer)
  - Add/remove/list/search feeds and categories
  - Validate feeds and produce reports
  - Export master and per‑category OPML
  - Quick stats for health and coverage
  - Optional local SQLite cache/metadata via SQLModel (e.g., validation results, feed health)

- Website and docs (Fumadocs + Next.js)
  - Documentation, blog, and category landing pages
  - Search-friendly structure and easy navigation
  - Ready for hosting on static providers

- Automation
  - GitHub Actions for scheduled validation, OPML rebuilds, and site deploys
  - PR checks for formatting, validation, and consistency
  - Makefile targets for common tasks and local dev ergonomics

## Stack

- Language and environment
  - Python 3.13+ managed with uv

- Data modeling and validation
  - Pydantic v2 models for feeds, categories, and metadata + SQLModel for typed persistence (SQLite) and caching

- Networking and crawling
  - httpx for fast, async-friendly HTTP requests
  - tenacity for resilient retries and backoff
  - crawlee-python for anonymous browsing and robust fetching when sites need it
  - RSSHub as a feed generator/fallback when sites lack RSS/Atom
  - Docling for robust parsing of PDFs and unstructured documents referenced by feeds

- CLI and tooling
  - Typer for a clean, typed command-line interface
  - Loguru for structured logging and rich diagnostics
  - Makefile for repeatable local workflows

- Web and docs
  - Fumadocs with Next.js for the documentation site, blog, and pages

- CI/CD and automation
  - GitHub Actions for scheduled jobs, validation, builds, and deploys
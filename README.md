# ai-web-feeds

***`ai-web-feeds`***
([wyattowalsh/ai-web-feeds](https://github.com/wyattowalsh/ai-web-feeds)) is the
ultimate collection of AI/ML-related feeds from around the web. GitHub Repo, OPML files,
Python CLI, and a Fumadocs-powered documentation site.

## Features

- Curated feed library

  - Organized by canonical topics and source types (e.g., research, news, company blogs,
    podcasts, newsletters)
  - Deduplication and canonicalization of sources
  - Clear naming and consistent metadata

- OPML export

  - One master OPML combining all feeds
  - Topic-grouped OPML files for selective import
  - Clean titles and folder hierarchy for readers

- Validation and quality checks

  - HTTP reachability and content-type validation
  - RSS/Atom auto-discovery from site URLs when needed
  - Robust retries and backoff for flaky endpoints
  - Basic analytics and summaries (topic coverage, source-type counts, validation stats)
  - Explicit RSSHub feed generation for platforms without native feeds (public or
    self-hosted instances)
  - PDF/unstructured parsing via Docling (optional; not yet in core dependencies)

- Advanced AI/NLP (Phase 5)

  - **Quality Scoring**: Heuristic-based article quality assessment (0-100 score)
  - **Entity Extraction**: spaCy NER for identifying people, organizations, techniques
  - **Sentiment Analysis**: DistilBERT-based sentiment classification with trend
    tracking
  - **Topic Modeling**: LDA-based subtopic discovery and evolution detection
  - Batch processing via APScheduler (hourly/monthly jobs)
  - Full-text search for entities (SQLite FTS5)
  - Manual curation workflows for subtopics

- Developer-friendly CLI (Typer)

  - Commands: enrich, opml, validate, export, stats, fetch, search, load, corpus,
    monitor, nlp, recommend, visualize, analytics, test, and process
  - Validate feeds and produce reports; export master and topic-grouped OPML
  - Quick stats, recommendations, corpus tools, and NLP pipelines
  - Optional local SQLite cache/metadata via SQLModel (e.g., validation results, feed
    health)

- Website and docs (Fumadocs + Next.js)

  - Documentation, explorer, downloads, and analytics surfaces
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

  - Pydantic v2 models for feeds, topics, and metadata + SQLModel for typed persistence
    (SQLite) and caching

- Networking and crawling

  - httpx for fast, async-friendly HTTP requests
  - tenacity for resilient retries and backoff
  - RSSHub as an explicit feed generator when sites lack RSS/Atom
  - (Optional / planned) crawlee-python and Docling for advanced fetching and PDF parsing

- CLI and tooling

  - Typer for a clean, typed command-line interface
  - Loguru for structured logging and rich diagnostics
  - Makefile for repeatable local workflows

- Web and docs

  - Fumadocs with Next.js for the documentation and web surfaces

- CI/CD and automation

  - GitHub Actions for scheduled jobs, validation, builds, and deploys

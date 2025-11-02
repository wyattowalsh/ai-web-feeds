# ============================================================================
# AI Web Feeds - Makefile
# ============================================================================
#
# ⚠️  CRITICAL: PACKAGE MANAGER REQUIREMENTS
#
# This project REQUIRES specific package managers:
#   - Python:  ONLY use 'uv' (NEVER pip/pip install/python -m pip/poetry)
#   - Node.js: ONLY use 'pnpm' (NEVER npm install/yarn)
#
# Rationale:
#   - uv is 10-100x faster than pip and handles workspace dependencies correctly
#   - pnpm uses efficient disk space with symlinks and has superior monorepo support
#
# Installation:
#   - uv:   curl -LsSf https://astral.sh/uv/install.sh | sh
#   - pnpm: npm install -g pnpm (one-time only, then never use npm again)
#
# ============================================================================

.PHONY: help install dev-install clean lint format type-check test test-cov pre-commit update-deps security-check all-checks docs-api docs-web check-uv check-pnpm

# Colors for terminal output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

# ============================================================================
# Package Manager Enforcement
# ============================================================================
check-uv: ## Verify uv is installed
	@command -v uv >/dev/null 2>&1 || { \
		echo '$(RED)ERROR: uv is not installed!$(NC)'; \
		echo '$(YELLOW)This project REQUIRES uv for Python package management.$(NC)'; \
		echo '$(YELLOW)Install it with: curl -LsSf https://astral.sh/uv/install.sh | sh$(NC)'; \
		echo '$(RED)NEVER use pip, pip install, or python -m pip$(NC)'; \
		exit 1; \
	}
	@echo '$(GREEN)✓ uv is installed$(NC)'

check-pnpm: ## Verify pnpm is installed
	@command -v pnpm >/dev/null 2>&1 || { \
		echo '$(RED)ERROR: pnpm is not installed!$(NC)'; \
		echo '$(YELLOW)This project REQUIRES pnpm for Node.js package management.$(NC)'; \
		echo '$(YELLOW)Install it with: npm install -g pnpm$(NC)'; \
		echo '$(RED)NEVER use npm install or yarn$(NC)'; \
		exit 1; \
	}
	@echo '$(GREEN)✓ pnpm is installed$(NC)'

help: ## Show this help message
	@echo '$(BLUE)AI Web Feeds - Development Commands$(NC)'
	@echo ''
	@echo '$(YELLOW)⚠️  CRITICAL: Package Manager Requirements$(NC)'
	@echo '  $(RED)Python: ONLY use uv (NEVER pip/pip install/poetry)$(NC)'
	@echo '  $(RED)Node.js: ONLY use pnpm (NEVER npm install/yarn)$(NC)'
	@echo ''
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ''

install: check-uv ## Install production dependencies using uv
	@echo "$(BLUE)Installing production dependencies with uv...$(NC)"
	uv sync --no-dev
	@echo "$(GREEN)✓ Dependencies installed!$(NC)"

dev-install: check-uv ## Install development dependencies
	@echo "$(BLUE)Installing development dependencies with uv...$(NC)"
	uv sync --extra dev
	@echo "$(BLUE)Installing pre-commit hooks...$(NC)"
	uv run pre-commit install
	uv run pre-commit install --hook-type commit-msg
	@echo "$(GREEN)✓ Development environment ready!$(NC)"
	@echo "$(YELLOW)Remember: Use 'uv' for Python, 'pnpm' for Node.js$(NC)"

clean: ## Clean up cache and build artifacts
	@echo "$(BLUE)Cleaning up...$(NC)"
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".mypy_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	rm -rf build/ dist/ .coverage htmlcov/ .tox/
	@echo "$(GREEN)✓ Cleaned!$(NC)"

lint: check-uv ## Run ruff linter
	@echo "$(BLUE)Running ruff linter with uv...$(NC)"
	uv run ruff check . --fix
	@echo "$(GREEN)✓ Linting complete!$(NC)"

lint-ci: check-uv ## Run ruff linter (CI mode - no fixes)
	@echo "$(BLUE)Running ruff linter (CI mode) with uv...$(NC)"
	uv run ruff check .

format: check-uv ## Format code with ruff
	@echo "$(BLUE)Formatting code with ruff via uv...$(NC)"
	uv run ruff format .
	@echo "$(GREEN)✓ Formatting complete!$(NC)"

format-check: check-uv ## Check code formatting without making changes
	@echo "$(BLUE)Checking code format with uv...$(NC)"
	uv run ruff format --check .

type-check: check-uv ## Run mypy type checker
	@echo "$(BLUE)Running mypy type checker via uv...$(NC)"
	uv run mypy packages/ai_web_feeds/src apps/cli/ai_web_feeds
	@echo "$(GREEN)✓ Type checking complete!$(NC)"

test: check-uv ## Run tests with pytest
	@echo "$(BLUE)Running tests via uv...$(NC)"
	uv run pytest
	@echo "$(GREEN)✓ Tests complete!$(NC)"

test-cov: check-uv ## Run tests with coverage report
	@echo "$(BLUE)Running tests with coverage via uv...$(NC)"
	uv run pytest --cov --cov-report=term-missing --cov-report=html
	@echo "$(GREEN)✓ Coverage report generated in htmlcov/$(NC)"

test-fast: check-uv ## Run tests without coverage (faster)
	@echo "$(BLUE)Running fast tests via uv...$(NC)"
	uv run pytest --no-cov -v
	@echo "$(GREEN)✓ Tests complete!$(NC)"

pre-commit: check-uv ## Run pre-commit hooks on all files
	@echo "$(BLUE)Running pre-commit hooks via uv...$(NC)"
	uv run pre-commit run --all-files
	@echo "$(GREEN)✓ Pre-commit checks complete!$(NC)"

pre-commit-update: check-uv ## Update pre-commit hooks
	@echo "$(BLUE)Updating pre-commit hooks via uv...$(NC)"
	uv run pre-commit autoupdate
	@echo "$(GREEN)✓ Pre-commit hooks updated!$(NC)"

update-deps: check-uv ## Update dependencies
	@echo "$(BLUE)Updating dependencies with uv...$(NC)"
	uv lock --upgrade
	@echo "$(GREEN)✓ Dependencies updated!$(NC)"

security-check: check-uv ## Run security checks with bandit
	@echo "$(BLUE)Running security checks via uv...$(NC)"
	uv run bandit -r packages/ai_web_feeds/src apps/cli/ai_web_feeds -f json -o bandit-report.json || true
	uv run bandit -r packages/ai_web_feeds/src apps/cli/ai_web_feeds
	@echo "$(GREEN)✓ Security check complete!$(NC)"

all-checks: clean lint format type-check test ## Run all quality checks
	@echo "$(GREEN)✓ All checks passed!$(NC)"

ci: lint-ci format-check type-check test ## Run CI checks (no auto-fixes)
	@echo "$(GREEN)✓ CI checks complete!$(NC)"

# Quick development workflow
dev: format lint test-fast ## Quick development check (format, lint, fast tests)
	@echo "$(GREEN)✓ Development checks complete!$(NC)"

# Documentation
docs-serve: check-pnpm ## Serve documentation locally (requires Next.js setup)
	@echo "$(BLUE)Starting documentation server with pnpm...$(NC)"
	cd apps/web && pnpm dev

docs-api: check-uv ## Generate Python API documentation
	@echo "$(BLUE)Generating Python API docs via uv...$(NC)"
	@echo "$(YELLOW)Step 1: Generating JSON from Python package...$(NC)"
	fumapy-generate ai_web_feeds
	@echo "$(YELLOW)Step 2: Moving JSON to web app...$(NC)"
	mv ai_web_feeds.json apps/web/
	@echo "$(YELLOW)Step 3: Converting to MDX with pnpm...$(NC)"
	cd apps/web && pnpm generate:docs
	@echo "$(GREEN)✓ API docs generated! View at: http://localhost:3000/docs/api$(NC)"

docs-web: check-pnpm ## Install web dependencies
	@echo "$(BLUE)Installing web dependencies with pnpm...$(NC)"
	cd apps/web && pnpm install
	@echo "$(GREEN)✓ Web dependencies installed!$(NC)"
	@echo "$(YELLOW)Remember: Always use pnpm for Node.js (NEVER npm/yarn)$(NC)"

.DEFAULT_GOAL := help

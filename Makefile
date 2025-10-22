.PHONY: help install dev-install clean lint format type-check test test-cov pre-commit update-deps security-check all-checks docs-api docs-web

# Colors for terminal output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

help: ## Show this help message
	@echo '$(BLUE)AI Web Feeds - Development Commands$(NC)'
	@echo ''
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ''

install: ## Install production dependencies using uv
	@echo "$(BLUE)Installing production dependencies...$(NC)"
	uv sync --no-dev

dev-install: ## Install development dependencies
	@echo "$(BLUE)Installing development dependencies...$(NC)"
	uv sync --extra dev
	@echo "$(BLUE)Installing pre-commit hooks...$(NC)"
	uv run pre-commit install
	@echo "$(GREEN)✓ Development environment ready!$(NC)"

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

lint: ## Run ruff linter
	@echo "$(BLUE)Running ruff linter...$(NC)"
	uv run ruff check . --fix
	@echo "$(GREEN)✓ Linting complete!$(NC)"

lint-ci: ## Run ruff linter (CI mode - no fixes)
	@echo "$(BLUE)Running ruff linter (CI mode)...$(NC)"
	uv run ruff check .

format: ## Format code with ruff
	@echo "$(BLUE)Formatting code with ruff...$(NC)"
	uv run ruff format .
	@echo "$(GREEN)✓ Formatting complete!$(NC)"

format-check: ## Check code formatting without making changes
	@echo "$(BLUE)Checking code format...$(NC)"
	uv run ruff format --check .

type-check: ## Run mypy type checker
	@echo "$(BLUE)Running mypy type checker...$(NC)"
	uv run mypy packages/ai_web_feeds/src apps/cli/ai_web_feeds
	@echo "$(GREEN)✓ Type checking complete!$(NC)"

test: ## Run tests with pytest
	@echo "$(BLUE)Running tests...$(NC)"
	uv run pytest
	@echo "$(GREEN)✓ Tests complete!$(NC)"

test-cov: ## Run tests with coverage report
	@echo "$(BLUE)Running tests with coverage...$(NC)"
	uv run pytest --cov --cov-report=term-missing --cov-report=html
	@echo "$(GREEN)✓ Coverage report generated in htmlcov/$(NC)"

test-fast: ## Run tests without coverage (faster)
	@echo "$(BLUE)Running fast tests...$(NC)"
	uv run pytest --no-cov -v
	@echo "$(GREEN)✓ Tests complete!$(NC)"

pre-commit: ## Run pre-commit hooks on all files
	@echo "$(BLUE)Running pre-commit hooks...$(NC)"
	uv run pre-commit run --all-files
	@echo "$(GREEN)✓ Pre-commit checks complete!$(NC)"

pre-commit-update: ## Update pre-commit hooks
	@echo "$(BLUE)Updating pre-commit hooks...$(NC)"
	uv run pre-commit autoupdate
	@echo "$(GREEN)✓ Pre-commit hooks updated!$(NC)"

update-deps: ## Update dependencies
	@echo "$(BLUE)Updating dependencies...$(NC)"
	uv lock --upgrade
	@echo "$(GREEN)✓ Dependencies updated!$(NC)"

security-check: ## Run security checks with bandit
	@echo "$(BLUE)Running security checks...$(NC)"
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
docs-serve: ## Serve documentation locally (requires Next.js setup)
	@echo "$(BLUE)Starting documentation server...$(NC)"
	cd apps/web && pnpm dev

docs-api: ## Generate Python API documentation
	@echo "$(BLUE)Generating Python API docs...$(NC)"
	@echo "$(YELLOW)Step 1: Generating JSON from Python package...$(NC)"
	fumapy-generate ai_web_feeds
	@echo "$(YELLOW)Step 2: Moving JSON to web app...$(NC)"
	mv ai_web_feeds.json apps/web/
	@echo "$(YELLOW)Step 3: Converting to MDX...$(NC)"
	cd apps/web && pnpm generate:docs
	@echo "$(GREEN)✓ API docs generated! View at: http://localhost:3000/docs/api$(NC)"

docs-web: ## Install web dependencies
	@echo "$(BLUE)Installing web dependencies...$(NC)"
	cd apps/web && pnpm install
	@echo "$(GREEN)✓ Web dependencies installed!$(NC)"

.DEFAULT_GOAL := help

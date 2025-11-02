# Multi-stage Dockerfile for AIWebFeeds Advanced Visualization

# Stage 1: Python Backend
FROM python:3.13-slim AS backend

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    redis-tools \
    && rm -rf /var/lib/apt/lists/*

# Install uv for Python package management
RUN pip install uv

# Copy Python project files
COPY packages/ai_web_feeds /app/packages/ai_web_feeds
COPY packages/alembic /app/packages/alembic
COPY packages/alembic.ini /app/packages/alembic.ini
COPY pyproject.toml /app/
COPY uv.lock /app/

# Install Python dependencies
RUN cd /app && uv sync

# Stage 2: Frontend Build
FROM node:20-alpine AS frontend

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY apps/web/package.json apps/web/pnpm-lock.yaml /app/apps/web/
COPY pnpm-workspace.yaml /app/

# Install dependencies
RUN cd /app/apps/web && pnpm install --frozen-lockfile

# Copy frontend source
COPY apps/web /app/apps/web

# Build frontend
RUN cd /app/apps/web && pnpm build

# Stage 3: Production Runtime
FROM python:3.13-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libpq5 \
    redis-tools \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy Python environment from backend stage
COPY --from=backend /app /app

# Copy built frontend from frontend stage
COPY --from=frontend /app/apps/web/.next /app/apps/web/.next
COPY --from=frontend /app/apps/web/public /app/apps/web/public

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Expose ports
EXPOSE 8000 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Start command (use supervisord in production)
CMD ["sh", "-c", "cd /app/packages && uv run uvicorn ai_web_feeds.visualization.api:app --host 0.0.0.0 --port 8000"]

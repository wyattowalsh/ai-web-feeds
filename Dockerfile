# syntax=docker/dockerfile:1.7

FROM docker.io/astral/uv:python3.13-trixie-slim AS monitor

WORKDIR /app

COPY pyproject.toml uv.lock ./
COPY packages/ai_web_feeds ./packages/ai_web_feeds
COPY apps/cli ./apps/cli
COPY data ./data

RUN uv sync --frozen --no-dev

ENV DATABASE_URL=sqlite:///data/ai-web-feeds.db

EXPOSE 8000

CMD ["uv", "run", "ai-web-feeds", "monitor", "start"]


FROM node:20-alpine AS web-builder

WORKDIR /app/apps/web

ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable

COPY apps/web/package.json apps/web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY apps/web ./
COPY data /app/data

RUN pnpm build


FROM node:20-alpine AS web

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=web-builder /app/apps/web/.next/standalone ./
COPY --from=web-builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

CMD ["node", "apps/web/server.js"]

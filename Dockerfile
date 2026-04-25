# syntax=docker/dockerfile:1.7
# Digest-pinned base images keep published containers traceable to immutable inputs.

FROM docker.io/astral/uv:python3.13-trixie-slim@sha256:571ea6cea7952397a93d4e0e972bb9635a7e40d2477228befb0d601eb682c0c0 AS monitor

WORKDIR /app

RUN useradd --create-home --uid 10001 appuser

COPY pyproject.toml uv.lock ./
COPY packages/ai_web_feeds ./packages/ai_web_feeds
COPY apps/cli ./apps/cli
COPY data ./data

RUN uv sync --frozen --no-dev
RUN chown -R appuser:appuser /app

ENV AIWF_DATABASE_URL=sqlite:///data/ai-web-feeds.db

EXPOSE 8000

USER appuser

CMD ["uv", "run", "ai-web-feeds", "monitor", "start"]


FROM node:20-alpine@sha256:42d1d5b07c84257b55d409f4e6e3be3b55d42867afce975a5648a3f231bf7e81 AS web-builder

WORKDIR /app/apps/web

ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_BASE_URL=https://ai-web-feeds.vercel.app
ARG NEXT_PUBLIC_WEBSOCKET_URL=
ARG NEXT_PUBLIC_PDF_EXPORT=false
ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}
ENV NEXT_PUBLIC_WEBSOCKET_URL=${NEXT_PUBLIC_WEBSOCKET_URL}
ENV NEXT_PUBLIC_PDF_EXPORT=${NEXT_PUBLIC_PDF_EXPORT}

RUN corepack enable

COPY apps/web/package.json apps/web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY apps/web ./
COPY data /app/data

RUN pnpm build


FROM node:20-alpine@sha256:42d1d5b07c84257b55d409f4e6e3be3b55d42867afce975a5648a3f231bf7e81 AS web

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=web-builder /app/apps/web/.next/standalone ./
COPY --from=web-builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

USER node

CMD ["node", "apps/web/server.js"]

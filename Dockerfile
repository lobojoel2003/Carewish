# syntax=docker/dockerfile:1.7
# Carewish — production image (Next.js standalone server).
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/form-rules/package.json packages/form-rules/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
ARG BUILD_NUMBER=docker
ARG COMMIT_SHA=unknown
ARG BUILD_DATE
ENV BUILD_NUMBER=${BUILD_NUMBER} \
    COMMIT_SHA=${COMMIT_SHA} \
    BUILD_DATE=${BUILD_DATE}
COPY . .
RUN pnpm --filter @carewish/form-rules build && pnpm --filter @carewish/web build

FROM node:${NODE_VERSION}-alpine AS runtime
ARG VERSION=0.0.0
ARG COMMIT_SHA=unknown
ARG BUILD_DATE
LABEL org.opencontainers.image.title="Carewish" \
      org.opencontainers.image.description="Plain-language advance directive builder with state forms, witness rules and FHIR export" \
      org.opencontainers.image.source="https://github.com/lobojoel2003/Carewish" \
      org.opencontainers.image.licenses="AGPL-3.0-only" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${COMMIT_SHA}" \
      org.opencontainers.image.created="${BUILD_DATE}"
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN addgroup -S carewish && adduser -S -G carewish carewish
COPY --from=build --chown=carewish:carewish /repo/apps/web/.next/standalone ./
COPY --from=build --chown=carewish:carewish /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=carewish:carewish /repo/apps/web/public ./apps/web/public
USER carewish
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "apps/web/server.js"]

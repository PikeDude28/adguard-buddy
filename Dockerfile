# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm lint && pnpm type-check
RUN pnpm build

FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Next's standalone output ships only the server and the modules it actually
# imports - no sources, no devDependencies, no package manager.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/docs ./docs
COPY --from=builder /app/pics ./pics

# Runtime state: connections, auto-sync config and logs.
RUN mkdir -p /app/.data /app/logs && chown -R node:node /app/.data /app/logs
VOLUME ["/app/.data", "/app/logs"]

ARG BUILD_DATE
ARG VCS_REF
ARG VERSION
LABEL org.opencontainers.image.created="${BUILD_DATE}" \
	org.opencontainers.image.revision="${VCS_REF}" \
	org.opencontainers.image.source="https://github.com/chrizzo84/adguard-buddy" \
	org.opencontainers.image.version="${VERSION}"

USER node
EXPOSE 3000

CMD ["node", "server.js"]

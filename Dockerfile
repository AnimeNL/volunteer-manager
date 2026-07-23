# syntax=docker/dockerfile:1
# check=skip=SecretsUsedInArgOrEnv

# ============================================
# Stage 1: Dependencies Installation Stage
# ============================================

ARG NODE_VERSION=26.5.0-slim

FROM node:${NODE_VERSION} AS dependencies

# Install Git, to be able to authenticate when installing the source tree.
RUN apt-get update && \
    apt-get install -y --no-install-recommends git && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package-related files first to leverage Docker's caching mechanism
COPY package.json package-lock.json* pnpm-lock.yaml* .npmrc* ./

ARG GH_TOKEN
RUN git config --global url."https://x-access-token:${GH_TOKEN}@github.com/".insteadOf "https://git@github.com/"

# Install project dependencies with frozen lockfile for reproducible builds
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=cache,target=/root/.local/share/pnpm/store \
  if [ -f package-lock.json ]; then \
    npm ci --no-audit --no-fund; \
  elif [ -f pnpm-lock.yaml ]; then \
    corepack enable pnpm && pnpm install --frozen-lockfile; \
  else \
    echo "No lockfile found." && exit 1; \
  fi

# ============================================
# Stage 2: Build Next.js application in standalone mode
# ============================================

FROM node:${NODE_VERSION} AS builder

# Set working directory
WORKDIR /app

# Copy project dependencies from dependencies stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy application source code
COPY . .

ENV NODE_ENV=production

# Build Next.js application
RUN --mount=type=cache,target=/app/.next/cache \
  if [ -f package-lock.json ]; then \
    npm run build; \
  elif [ -f pnpm-lock.yaml ]; then \
    corepack enable pnpm && pnpm build; \
  else \
    echo "No lockfile found." && exit 1; \
  fi

# ============================================
# Stage 3: Run Next.js application
# ============================================

FROM node:${NODE_VERSION} AS runner

# Install curl, to be able to run healthchecks within the container
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy production assets
COPY --from=builder --chown=node:node /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown node:node .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Switch to non-root user for security best practices
USER node

# Expose port 3000 to allow HTTP traffic
EXPOSE 3000

# Expose the environment information to the runtime
ENV PORT=$PORT
ENV HOSTNAME="0.0.0.0"

# Start Next.js standalone server
CMD ["node", "server.js"]

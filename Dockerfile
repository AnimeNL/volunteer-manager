# syntax=docker/dockerfile:1
# check=skip=SecretsUsedInArgOrEnv

FROM node:24-alpine AS base

# 1. Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat git

WORKDIR /app

COPY package.json package-lock.json* ./

# Install dependencies based on the preferred package manager
ARG GH_TOKEN
RUN git config --global url."https://x-access-token:${GH_TOKEN}@github.com/".insteadOf "https://git@github.com/" \
    && npm ci --force

# 2. Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Expose the git revision to the build system, as git won't be installed on the image.
ARG SOURCE_COMMIT=0
ENV SOURCE_COMMIT=$SOURCE_COMMIT

# This will do the trick, use the corresponding env file for each environment.
RUN npm run build

# 3. Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 anime
RUN adduser --system --uid 1001 anime

COPY --from=builder --chown=anime:anime /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown anime:anime .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=anime:anime /app/.next/standalone ./
COPY --from=builder --chown=anime:anime /app/.next/static ./.next/static

USER anime

# Sets the port on which the Next.js server should be running, which differs for staging and prod.
ARG PORT=3001

EXPOSE $PORT

ENV PORT=$PORT
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

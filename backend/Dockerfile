# backend/Dockerfile
#
# Multi-stage build:
#   Stage 1: Install deps + compile TypeScript
#   Stage 2: Production image with only compiled JS

# ── Build stage ───────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for all workspaces
COPY package.json tsconfig.json ./
COPY sdk/package.json sdk/tsconfig.json ./sdk/
COPY backend/package.json backend/tsconfig.json ./backend/

# Install all dependencies
RUN npm install --workspaces --include-workspace-root

# Copy source code
COPY sdk/ ./sdk/
COPY backend/ ./backend/

# Build SDK first (backend depends on it)
RUN cd sdk && npm run build

# Build backend
RUN cd backend && npm run build

# ── Production stage ──────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy package files
COPY package.json ./
COPY sdk/package.json ./sdk/
COPY backend/package.json ./backend/

# Install production deps only
RUN npm install --workspaces --include-workspace-root --omit=dev

# Copy compiled code from builder
COPY --from=builder /app/sdk/dist ./sdk/dist
COPY --from=builder /app/backend/dist ./backend/dist

# Copy IDL (required at runtime)
COPY sdk/idl ./sdk/idl

# Non-root user for security
RUN addgroup -g 1001 sss && adduser -u 1001 -G sss -D sss
USER sss

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:3000/health/live || exit 1

CMD ["node", "backend/dist/main.js"]
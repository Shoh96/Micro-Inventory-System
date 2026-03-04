# =============================================================
# Community Micro-Inventory System V2 — Multi-stage Dockerfile
# =============================================================
# Stage 1 (builder): Install all deps including devDependencies.
# Stage 2 (production): Copy only what's needed to run the server.
#
# Usage:
#   docker build -t micro-inventory .
#   docker run -p 3000:3000 -v $(pwd)/data:/app/data micro-inventory

# ── Stage 1: Build ────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files first for layer caching — reinstall only when they change.
COPY server/package*.json ./server/

RUN cd server && npm ci --only=production

# ── Stage 2: Production ───────────────────────────────────────
FROM node:20-slim AS production

# Create non-root user for security.
RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

# Copy server code and installed modules from builder stage.
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY server/ ./server/
COPY client/ ./client/

# Data directory will hold the SQLite .db file.
# Mount this as a volume in production to persist across deploys.
RUN mkdir -p /app/data && chown -R appuser:appuser /app

USER appuser

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/inventory.db
# JWT_SECRET and CLIENT_ORIGIN must be set via environment variables / docker-compose.

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server/app.js"]

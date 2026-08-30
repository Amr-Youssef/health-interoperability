# =========================================================================
# Saudi National Health Interoperability Platform
# Multi-Stage Production Dockerfile (NCA Cyber Security & Production Ready)
# =========================================================================

# Stage 1: Build & Dependencies
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json tsconfig.json ./
RUN npm ci

# Copy source code and static UI assets
COPY src/ ./src/
COPY public/ ./public/

# Build TypeScript to JavaScript
RUN npm run build

# Stage 2: Minimal Secure Runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application and static assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Create non-root user for security compliance (NCA Standard)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

# Health check probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/fhir/metadata || exit 1

CMD ["node", "dist/api/server.js"]

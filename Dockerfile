# Multi-stage build for production
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Copy source code (excluding node_modules via .dockerignore)
COPY . .

# Clean any existing node_modules to ensure platform-specific binaries are correct
RUN rm -rf node_modules client/node_modules server/node_modules

# Install dependencies (including dev dependencies for building)
RUN npm ci

# Build client
WORKDIR /app/client
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install PostgreSQL client and FFmpeg
RUN apk add --no-cache postgresql-client ffmpeg

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built client
COPY --from=builder /app/client/dist ./client/dist

# Copy server code
COPY server/ ./server/

# Create uploads directory
RUN mkdir -p /app/server/uploads

# Change ownership
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5001/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "server/index.js"]

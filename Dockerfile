# Use Node.js 18 Alpine as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies for native modules and FFmpeg
RUN apk add --no-cache python3 make g++ ffmpeg libc6-compat

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm rebuild sharp || true

# Copy pre-built application
COPY dist/ ./dist/

# Create necessary directories
RUN mkdir -p uploads logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "dist/app.js"]

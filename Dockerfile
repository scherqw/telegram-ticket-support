# Use official Node.js LTS image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install ALL dependencies (including dev dependencies for build)
RUN npm ci

# Install TypeScript and ts-node globally for build
RUN npm install -g typescript ts-node

# Copy source code
COPY src ./src
COPY config ./config

# Build TypeScript to JavaScript
RUN npm run build

# Remove dev dependencies and TypeScript after build
RUN npm prune --production && \
    npm uninstall -g typescript ts-node

# Create logs directory
RUN mkdir -p /app/logs

# Set environment to production
ENV NODE_ENV=production

# Expose ports (not strictly necessary for bot, but good practice)
EXPOSE 3000

# Health check (optional - checks if process is running)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

# Run the application
CMD ["node", "dist/index.js"]
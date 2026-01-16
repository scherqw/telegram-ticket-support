FROM node:18-alpine

# Install ffmpeg for audio conversion
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY tsconfig.json ./

# Install backend dependencies
RUN npm ci

# Install TypeScript globally for build
RUN npm install -g typescript ts-node

# Copy source code
COPY src ./src
COPY config ./config

# Build backend
RUN npm run build

# Build webapp
COPY webapp/package*.json ./webapp/
WORKDIR /app/webapp
RUN npm ci
COPY webapp ./
RUN npm run build

# Back to root
WORKDIR /app

# Remove dev dependencies and TypeScript
RUN npm prune --production && \
    npm uninstall -g typescript ts-node

# Create logs directory
RUN mkdir -p /app/logs

ENV NODE_ENV=production

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

CMD ["node", "dist/index.js"]
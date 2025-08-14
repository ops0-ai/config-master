# API Dockerfile using Turbo for proper workspace builds
FROM node:18-alpine

# Install dependencies for native modules and PostgreSQL client
RUN apk add --no-cache python3 make g++ openssl postgresql-client

# Set working directory
WORKDIR /app

# Copy all package files and turbo config
COPY package*.json ./
COPY turbo.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/database/package*.json ./packages/database/
COPY packages/ansible-engine/package*.json ./packages/ansible-engine/

# Install all dependencies for the workspace
RUN npm install

# Copy all source code
COPY apps/api ./apps/api
COPY packages ./packages

# Use Turbo to build just the API and its dependencies
RUN npx turbo build --filter=api

# Set working directory to API
WORKDIR /app/apps/api

# Remove dev dependencies to reduce image size
RUN npm prune --production --legacy-peer-deps

# Create directories for uploads and logs
RUN mkdir -p /app/uploads /app/logs /secure/pem-keys

# Expose port
EXPOSE 5005

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5005/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Run the application
CMD ["npm", "start"]
# API Dockerfile - Reliable working server
FROM node:18-alpine

# Install dependencies for native modules, PostgreSQL client, and Ansible
RUN apk add --no-cache python3 py3-pip make g++ openssl postgresql-client openssh-client && \
    python3 -m pip install --break-system-packages --upgrade pip && \
    python3 -m pip install --break-system-packages ansible

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/database/package*.json ./packages/database/
COPY packages/ansible-engine/package*.json ./packages/ansible-engine/

# Install dependencies
RUN npm install

# Set working directory to API
WORKDIR /app/apps/api

# Copy TypeScript configuration and source files
COPY apps/api/tsconfig.json ./
COPY apps/api/drizzle.config.ts ./
COPY apps/api/drizzle ./drizzle
COPY apps/api/src ./src

# Go back to workspace root and copy packages for proper module resolution
WORKDIR /app
COPY packages ./packages

# Create empty mdm-agent directory first
RUN mkdir -p ./mdm-agent

# Copy MDM agent files (use shell expansion to handle missing files)
COPY mdm-agent/ ./mdm-agent/

# Copy pulse-agent-remove.sh 
COPY pulse-agent-remove.sh ./pulse-agent-remove.sh

# Create public directory and copy pre-built hive agent binaries for distribution
RUN mkdir -p ./apps/api/public

# Copy all pre-built cross-platform hive agent binaries
COPY hive-agent/hive-agent-linux-amd64 ./apps/api/public/hive-agent-linux-amd64
COPY hive-agent/hive-agent-linux-arm64 ./apps/api/public/hive-agent-linux-arm64
COPY hive-agent/hive-agent-linux-386 ./apps/api/public/hive-agent-linux-386
COPY hive-agent/hive-agent-linux-arm ./apps/api/public/hive-agent-linux-arm
COPY hive-agent/hive-agent-windows-amd64.exe ./apps/api/public/hive-agent-windows-amd64.exe
COPY hive-agent/hive-agent-darwin-amd64 ./apps/api/public/hive-agent-darwin-amd64
COPY hive-agent/hive-agent-darwin-arm64 ./apps/api/public/hive-agent-darwin-arm64
COPY hive-agent/hive-agent-freebsd-amd64 ./apps/api/public/hive-agent-freebsd-amd64

# Create symlink for backward compatibility
RUN ln -sf hive-agent-linux-amd64 ./apps/api/public/hive-agent-binary && \
    echo "✅ All hive agent binaries copied successfully" && \
    ls -la ./apps/api/public/hive-agent-*

# Build packages in dependency order
WORKDIR /app/packages/database
RUN npm run build || npx tsc

WORKDIR /app/packages/ansible-engine  
RUN npm run build || npx tsc || true

# Go back to API directory and compile TypeScript
WORKDIR /app/apps/api
RUN npx tsc --project ./tsconfig.json

# Copy the compiled files to the expected structure
RUN mkdir -p dist && \
    cp dist/apps/api/src/index.js dist/index.js 2>/dev/null || true && \
    cp -r dist/apps/api/src/* dist/ 2>/dev/null || true && \
    cp src/routes/simple-assets.js dist/routes/simple-assets.js 2>/dev/null || true

# Remove dev dependencies after build
WORKDIR /app
RUN npm prune --production

# Set final working directory
WORKDIR /app/apps/api

# Create required directories
RUN mkdir -p /app/uploads /app/logs /secure/pem-keys

# No startup script needed - database initialization is handled by the application

# Expose port
EXPOSE 5005

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5005/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Run the application
CMD ["npm", "start"]
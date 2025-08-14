# API Dockerfile - Reliable working server
FROM node:18-alpine

# Install dependencies for native modules and PostgreSQL client  
RUN apk add --no-cache python3 make g++ openssl postgresql-client

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

# Go back to API directory and compile TypeScript
WORKDIR /app/apps/api
RUN npx tsc --project ./tsconfig.json

# Remove dev dependencies after build
WORKDIR /app
RUN npm prune --production

# Set final working directory
WORKDIR /app/apps/api

# Create required directories
RUN mkdir -p /app/uploads /app/logs /secure/pem-keys

# Create startup script that runs migrations and starts the server
RUN cat > start.sh << 'EOF'
#!/bin/sh
echo "🗄️ Running database migrations..."
npx drizzle-kit push:pg --config=./drizzle.config.ts 2>/dev/null || echo "⚠️ Migrations may have failed, continuing..."

echo "🚀 Starting Pulse API Server..."
node dist/apps/api/src/index.js
EOF

RUN chmod +x start.sh

# Expose port
EXPOSE 5005

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5005/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Run the application with migrations
CMD ["./start.sh"]
# Simple Node.js API Dockerfile
FROM node:18-alpine

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++ openssl

# Set working directory
WORKDIR /app

# Copy package files for workspace setup
COPY package*.json ./
COPY turbo.json ./

# Copy package files for all workspaces
COPY apps/api/package*.json ./apps/api/
COPY packages/database/package*.json ./packages/database/

# Install all dependencies (including workspaces)
RUN npm install

# Copy source code
COPY apps/api ./apps/api
COPY packages/database ./packages/database

# Build packages in correct dependency order
# First build the database package
WORKDIR /app/packages/database
RUN npm run build

# Then build the API
WORKDIR /app/apps/api
RUN npm run build

# Remove dev dependencies to reduce image size
WORKDIR /app
RUN npm prune --production

# Create directories for uploads and logs
RUN mkdir -p /app/uploads /app/logs /secure/pem-keys

# Set final working directory
WORKDIR /app/apps/api

# Expose port
EXPOSE 5005

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5005/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Run the application
CMD ["npm", "start"]
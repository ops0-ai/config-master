# Simple Node.js API Dockerfile
FROM node:18-alpine

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++ openssl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY turbo.json ./

# Copy API and database package files
COPY apps/api/package*.json ./apps/api/
COPY packages/database/package*.json ./packages/database/

# Install all dependencies first
RUN npm install

# Copy source code
COPY apps/api ./apps/api
COPY packages/database ./packages/database

# Build the application
WORKDIR /app/apps/api
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Create directories for uploads and logs
RUN mkdir -p /app/uploads /app/logs /secure/pem-keys

# Expose port
EXPOSE 5005

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5005/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Run the application
CMD ["npm", "start"]
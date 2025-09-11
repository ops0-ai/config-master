# Build stage
FROM golang:1.21-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git make

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Use the correct pre-built binary based on target architecture
ARG TARGETARCH
RUN echo "Building for architecture: ${TARGETARCH}" && ls -la hive-agent-linux-*
COPY hive-agent-linux-${TARGETARCH} pulse-hive-agent

# Runtime stage
FROM alpine:3.18

# Install runtime dependencies
RUN apk add --no-cache ca-certificates tzdata

# Create user and directories
RUN addgroup -g 1000 -S pulse-hive && \
    adduser -u 1000 -S pulse-hive -G pulse-hive

# Create directories
RUN mkdir -p /etc/pulse-hive /var/lib/pulse-hive /var/log/pulse-hive && \
    chown -R pulse-hive:pulse-hive /var/lib/pulse-hive /var/log/pulse-hive

# Copy binary from builder stage
COPY --from=builder /app/pulse-hive-agent /usr/local/bin/

# Copy configuration template
COPY configs/config.yaml.template /etc/pulse-hive/

# Set permissions
RUN chmod +x /usr/local/bin/pulse-hive-agent

# Switch to non-root user
USER pulse-hive

# Set working directory
WORKDIR /var/lib/pulse-hive

# Expose health check port
EXPOSE 8081

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8081/health || exit 1

# Default command - let it use default config path
ENTRYPOINT ["/usr/local/bin/pulse-hive-agent"]
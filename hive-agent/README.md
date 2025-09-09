# Pulse Hive Agent

A resilient, distributed observability agent for the Pulse platform that collects logs, metrics, traces, and events from systems and applications.

## Features

- **Multi-Source Data Collection**: Collect logs, metrics, traces, and system events
- **Error Detection**: Advanced pattern matching to detect issues and anomalies
- **Resilient Architecture**: Automatic reconnection, buffering, and retry logic
- **Real-time Communication**: WebSocket support for command execution and live updates
- **Flexible Output**: Send data to multiple destinations (HTTP, Elasticsearch, Prometheus)
- **Configuration Management**: Hot-reload configuration from the Pulse platform
- **System Integration**: Native systemd service support
- **Resource Efficient**: Minimal memory footprint with configurable resource limits

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Pulse Hive Agent                         │
├─────────────────────────────────────────────────────────────┤
│  Collectors     │  Pipeline      │  Outputs               │
│                 │                │                        │
│  ┌─────────────┐│  ┌───────────┐ │  ┌───────────────────┐ │
│  │ Log         ││  │ Buffer    │ │  │ HTTP              │ │
│  │ Collector   ││  │ Batch     │ │  │ (Pulse Platform)  │ │
│  └─────────────┘│  │ Compress  │ │  └───────────────────┘ │
│                 │  │ Process   │ │                        │
│  ┌─────────────┐│  └───────────┘ │  ┌───────────────────┐ │
│  │ Metrics     ││                │  │ Elasticsearch     │ │
│  │ Collector   ││                │  │                   │ │
│  └─────────────┘│                │  └───────────────────┘ │
│                 │                │                        │
│  ┌─────────────┐│                │  ┌───────────────────┐ │
│  │ Traces      ││                │  │ Prometheus        │ │
│  │ Collector   ││                │  │                   │ │
│  └─────────────┘│                │  └───────────────────┘ │
│                 │                │                        │
│  ┌─────────────┐│                │                        │
│  │ Events      ││                │                        │
│  │ Collector   ││                │                        │
│  └─────────────┘│                │                        │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Pulse Platform    │
                    │                     │
                    │ • Agent Management  │
                    │ • Configuration     │
                    │ • Commands          │
                    │ • Alerting          │
                    └─────────────────────┘
```

## Quick Start

### Installation

#### Option 1: Download and Install Script

```bash
# Download the latest release
curl -L https://github.com/pulse-platform/hive-agent/releases/latest/download/install.sh | sudo bash

# Or download specific version
curl -L https://releases.pulse-platform.com/hive-agent/install.sh | sudo bash
```

#### Option 2: Manual Installation

```bash
# Clone the repository
git clone https://github.com/pulse-platform/hive-agent
cd hive-agent

# Build and install
make install
```

#### Option 3: Docker

```bash
# Run with Docker
docker run -d --name pulse-hive-agent \
  -v /var/log:/var/log:ro \
  -v /proc:/host/proc:ro \
  -v /sys:/host/sys:ro \
  -v ./config.yaml:/etc/pulse-hive/config.yaml \
  pulse-hive-agent:latest
```

### Configuration

1. Edit the configuration file:
   ```bash
   sudo nano /etc/pulse-hive/config.yaml
   ```

2. Set your Pulse server URL and API key:
   ```yaml
   server:
     url: "https://your-pulse-server.com"
     api_key: "your-api-key-here"
   ```

3. Enable and start the service:
   ```bash
   sudo systemctl enable pulse-hive-agent
   sudo systemctl start pulse-hive-agent
   ```

4. Check the status:
   ```bash
   sudo systemctl status pulse-hive-agent
   ```

## Configuration

The agent is configured via YAML. See [configs/config.yaml.template](configs/config.yaml.template) for a complete example.

### Key Configuration Sections

#### Server Connection
```yaml
server:
  url: "https://your-pulse-server.com"
  api_key: "your-api-key-here"
  heartbeat_interval: 30s
  reconnect_interval: 10s
  max_reconnects: 3
  timeout: 30s
```

#### Data Collectors
```yaml
collectors:
  logs:
    enabled: true
    paths:
      - path: "/var/log/**/*.log"
        parser: "json"
        tags:
          source: "system"
    patterns:
      - name: "error_detection"
        pattern: "(?i)(error|exception|fatal)"
        severity: "error"
  
  metrics:
    enabled: true
    interval: 60s
    system:
      cpu: true
      memory: true
      disk: true
```

#### Output Destinations
```yaml
outputs:
  - name: "pulse_platform"
    type: "http"
    enabled: true
    url: "https://your-pulse-server.com/api/hive/telemetry"
    auth:
      type: "bearer"
      token: "your-api-key-here"
```

## Development

### Prerequisites

- Go 1.21 or higher
- Make
- Git

### Building

```bash
# Install dependencies
make deps

# Build for current platform
make build

# Build for all platforms
make build-all

# Run tests
make test

# Run with coverage
make test-coverage
```

### Development Mode

```bash
# Run in development mode
make dev

# Or run directly
go run . -config configs/config.yaml.template
```

## Monitoring

### Health Checks

The agent exposes a health check endpoint:

```bash
curl http://localhost:8081/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2023-10-01T12:00:00Z",
  "uptime": "1h30m45s",
  "version": "1.0.0"
}
```

### Logs

View logs using journalctl:

```bash
# Follow logs
sudo journalctl -u pulse-hive-agent -f

# View recent logs
sudo journalctl -u pulse-hive-agent -n 100
```

### Metrics

The agent exposes Prometheus metrics on port 8080:

```bash
curl http://localhost:8080/metrics
```

## Data Collection

### Log Collection

- **File Monitoring**: Tail log files with rotation support
- **Pattern Matching**: Detect errors and anomalies using regex patterns
- **Parsing**: JSON, regex, and grok parsing support
- **Multiline**: Handle stack traces and multi-line logs

### System Metrics

- **CPU**: Usage percentage, per-core metrics, load average
- **Memory**: Total, used, available, swap metrics
- **Disk**: Usage, free space, I/O statistics per partition
- **Network**: Interface statistics, bytes/packets sent/received
- **Processes**: Count by status, resource usage

### Distributed Tracing

- **OTLP Support**: Receive traces via OpenTelemetry Protocol
- **Multiple Formats**: Jaeger, Zipkin compatibility
- **Sampling**: Configurable sampling rates

### System Events

- **File System**: File changes, disk events
- **Process**: Process start/stop, crashes
- **Network**: Connection events
- **Services**: Service status changes

## Error Detection

The agent includes intelligent error detection capabilities:

### Pattern-Based Detection

```yaml
patterns:
  - name: "out_of_memory"
    pattern: "(?i)(out of memory|oom|memory allocation failed)"
    severity: "critical"
    category: "system"
    suggested_fix: "Increase memory or optimize memory usage"
```

### Anomaly Detection

- Statistical analysis of metric patterns
- Threshold-based alerting
- Rate-of-change detection

## Command Execution

The agent can execute commands remotely via WebSocket connection:

```bash
# The platform can send commands like:
{
  "id": "cmd-123",
  "type": "shell",
  "command": "df -h",
  "timeout": "30s"
}
```

## Security

### Authentication

- API key authentication for platform communication
- TLS support for encrypted communication
- Certificate-based authentication (optional)

### Permissions

- Runs as non-root user (`pulse-hive`)
- Minimal required capabilities
- Read-only access to system files
- Sandboxed execution environment

### Network Security

- Outbound connections only
- Configurable firewall rules
- VPN/proxy support

## Troubleshooting

### Common Issues

#### Agent Won't Start
```bash
# Check service status
sudo systemctl status pulse-hive-agent

# Check configuration
pulse-hive-agent -config /etc/pulse-hive/config.yaml -help

# Validate configuration
sudo -u pulse-hive pulse-hive-agent -config /etc/pulse-hive/config.yaml -validate
```

#### Connection Issues
```bash
# Test connectivity
curl -k https://your-pulse-server.com/health

# Check DNS resolution
nslookup your-pulse-server.com

# Verify API key
curl -H "Authorization: Bearer your-api-key" https://your-pulse-server.com/api/hive/agents
```

#### High Resource Usage
```bash
# Check memory usage
ps aux | grep pulse-hive-agent

# Reduce batch size and buffer
# Edit /etc/pulse-hive/config.yaml
agent:
  buffer_size: 1000
  batch_size: 100
```

### Debug Mode

Enable debug logging:

```yaml
logging:
  level: "debug"
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes and add tests
4. Run the test suite: `make test`
5. Submit a pull request

## License

Licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Support

- Documentation: https://docs.pulse-platform.com/hive-agent
- Issues: https://github.com/pulse-platform/hive-agent/issues
- Community: https://discord.gg/pulse-platform
- Email: support@pulse-platform.com
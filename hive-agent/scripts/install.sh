#!/bin/bash
# Pulse Hive Agent Installation Script

set -e

BINARY_NAME="pulse-hive-agent"
INSTALL_DIR="/usr/local/bin"
CONFIG_DIR="/etc/pulse-hive"
DATA_DIR="/var/lib/pulse-hive"
LOG_DIR="/var/log/pulse-hive"
SERVICE_NAME="pulse-hive-agent"
USER="pulse-hive"
GROUP="pulse-hive"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   log_error "This script must be run as root"
   exit 1
fi

# Detect OS and architecture
detect_platform() {
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    ARCH=$(uname -m)
    
    case $ARCH in
        x86_64)
            ARCH="amd64"
            ;;
        aarch64|arm64)
            ARCH="arm64"
            ;;
        *)
            log_error "Unsupported architecture: $ARCH"
            exit 1
            ;;
    esac
    
    PLATFORM="${OS}-${ARCH}"
    log_info "Detected platform: $PLATFORM"
}

# Download and install binary
install_binary() {
    log_info "Installing Pulse Hive Agent binary..."
    
    # Create directories
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$CONFIG_DIR"
    mkdir -p "$DATA_DIR"
    mkdir -p "$LOG_DIR"
    
    # Build from source to get latest version with all fixes
    log_info "Building agent from source..."
    
    # Find the source directory
    SOURCE_DIR=$(dirname "$(dirname "$0")")
    if [[ ! -f "$SOURCE_DIR/main.go" ]]; then
        log_error "Source not found. Please run from the hive-agent directory."
        exit 1
    fi
    
    # Build the agent
    cd "$SOURCE_DIR"
    go build -o "${BINARY_NAME}" . || {
        log_error "Failed to build agent"
        exit 1
    }
    
    # Install the binary
    cp "${BINARY_NAME}" "$INSTALL_DIR/${BINARY_NAME}"
    chmod +x "$INSTALL_DIR/${BINARY_NAME}"
    log_success "Agent built and installed to $INSTALL_DIR/${BINARY_NAME}"
}

# Create user and group
create_user() {
    log_info "Creating user and group..."
    
    # Create group if it doesn't exist
    if ! getent group "$GROUP" > /dev/null 2>&1; then
        groupadd --system "$GROUP"
        log_success "Created group: $GROUP"
    fi
    
    # Create user if it doesn't exist
    if ! getent passwd "$USER" > /dev/null 2>&1; then
        useradd --system --gid "$GROUP" --home-dir "$DATA_DIR" --shell /bin/false "$USER"
        log_success "Created user: $USER"
    fi
    
    # Set ownership
    chown -R "$USER:$GROUP" "$DATA_DIR"
    chown -R "$USER:$GROUP" "$LOG_DIR"
    chown "$USER:$GROUP" "$CONFIG_DIR"
}

# Install systemd service
install_service() {
    log_info "Installing systemd service..."
    
    # Copy service file
    if [[ -f "scripts/${SERVICE_NAME}.service" ]]; then
        cp "scripts/${SERVICE_NAME}.service" "/etc/systemd/system/"
        systemctl daemon-reload
        log_success "Service installed"
    else
        log_warning "Service file not found, creating minimal service..."
        
        cat > "/etc/systemd/system/${SERVICE_NAME}.service" << EOF
[Unit]
Description=Pulse Hive Agent
After=network.target

[Service]
Type=simple
User=$USER
Group=$GROUP
ExecStart=$INSTALL_DIR/$BINARY_NAME -config $CONFIG_DIR/config.yaml
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
        systemctl daemon-reload
        log_success "Minimal service created"
    fi
}

# Install configuration template
install_config() {
    log_info "Installing configuration template..."
    
    if [[ -f "configs/config.yaml.template" ]]; then
        cp "configs/config.yaml.template" "$CONFIG_DIR/config.yaml.template"
        log_success "Configuration template installed"
        
        if [[ ! -f "$CONFIG_DIR/config.yaml" ]]; then
            log_info "Creating default configuration..."
            cp "$CONFIG_DIR/config.yaml.template" "$CONFIG_DIR/config.yaml"
            
            # Update default values
            sed -i 's/${PULSE_SERVER_URL}/https:\/\/your-pulse-server.com/g' "$CONFIG_DIR/config.yaml"
            sed -i 's/${PULSE_API_KEY}/your-api-key-here/g' "$CONFIG_DIR/config.yaml"
            sed -i "s/\${HOSTNAME}/$(hostname)/g" "$CONFIG_DIR/config.yaml"
            
            log_warning "Please edit $CONFIG_DIR/config.yaml with your Pulse server details"
        fi
    else
        log_warning "Configuration template not found, creating minimal config..."
        
        cat > "$CONFIG_DIR/config.yaml" << EOF
server:
  url: "https://your-pulse-server.com"
  api_key: "your-api-key-here"
  heartbeat_interval: 30s

agent:
  name: "$(hostname)"
  hostname: "$(hostname)"

logging:
  level: "info"
  format: "json"
  output: "stdout"

collectors:
  logs:
    enabled: true
  metrics:
    enabled: true

outputs:
  - name: "pulse_platform"
    type: "http"
    enabled: true
    url: "https://your-pulse-server.com/api/hive/telemetry"
EOF
        log_warning "Please edit $CONFIG_DIR/config.yaml with your configuration"
    fi
    
    chown "$USER:$GROUP" "$CONFIG_DIR/config.yaml"
}

# Main installation
main() {
    log_info "Starting Pulse Hive Agent installation..."
    
    detect_platform
    install_binary
    create_user
    install_service
    install_config
    
    log_success "Installation completed!"
    log_info ""
    log_info "Next steps:"
    log_info "1. Edit the configuration file: $CONFIG_DIR/config.yaml"
    log_info "2. Enable the service: systemctl enable $SERVICE_NAME"
    log_info "3. Start the service: systemctl start $SERVICE_NAME"
    log_info "4. Check status: systemctl status $SERVICE_NAME"
    log_info ""
    log_info "Logs can be viewed with: journalctl -u $SERVICE_NAME -f"
}

# Run main function
main "$@"
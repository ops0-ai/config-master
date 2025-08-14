#!/bin/bash

#############################################
# Pulse Configuration Management Setup Script
# End-to-End Deployment for Fresh Servers
#############################################

set -e

# Ensure we're running with bash
if [ -z "$BASH_VERSION" ]; then
    echo "This script requires bash. Please run with: bash setup.sh"
    exit 1
fi

# Compatibility check
if ! command -v bash >/dev/null 2>&1; then
    echo "Bash is required but not found. Please install bash."
    exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/setup.log"

# Function to log messages
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

# Install Docker if needed
install_docker() {
    log "🐳 Installing Docker..."
    
    # Detect OS
    if [ -f /etc/debian_version ]; then
        # Ubuntu/Debian
        apt-get update
        apt-get install -y ca-certificates curl gnupg lsb-release
        
        # Add Docker's official GPG key
        mkdir -p /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        
        # Set up repository
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
        
        # Install Docker
        apt-get update
        apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
        
        # Start Docker
        systemctl start docker
        systemctl enable docker
        
        log "✅ Docker installed successfully"
    else
        error "Unsupported OS. Please install Docker manually: https://docs.docker.com/engine/install/"
    fi
}

# Check prerequisites
check_prerequisites() {
    log "🔍 Checking prerequisites..."
    
    # Check if running as root for Docker installation
    if [ "$EUID" -ne 0 ] && ! command -v docker >/dev/null 2>&1; then
        error "Docker is not installed and script is not running as root. Please either:\n  1. Install Docker manually, or\n  2. Run with sudo: sudo bash setup.sh"
    fi
    
    # Check Docker
    if ! command -v docker >/dev/null 2>&1; then
        warning "Docker is not installed. Installing Docker..."
        install_docker
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
        error "Docker Compose is not available. Please install Docker Compose."
    fi
    
    # Determine docker-compose command
    if docker compose version >/dev/null 2>&1; then
        DOCKER_COMPOSE="docker compose"
    else
        DOCKER_COMPOSE="docker-compose"
    fi
    
    # Ensure Docker daemon is running
    if ! docker info >/dev/null 2>&1; then
        log "Starting Docker daemon..."
        systemctl start docker 2>/dev/null || service docker start 2>/dev/null || {
            error "Could not start Docker daemon. Please start it manually."
        }
        sleep 3
    fi
    
    log "✅ Prerequisites check completed"
}

# Setup environment variables
setup_environment() {
    log "🔧 Setting up environment variables..."
    
    # Get server IP address for CORS configuration
    SERVER_IP="localhost"
    if command -v hostname &> /dev/null; then
        # Try to get external IP first
        EXTERNAL_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || echo "")
        if [ -n "$EXTERNAL_IP" ]; then
            SERVER_IP="$EXTERNAL_IP"
            log "🌐 Detected external IP: $SERVER_IP"
        else
            # Fallback to local IP
            LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
            if [ "$LOCAL_IP" != "" ] && [ "$LOCAL_IP" != "localhost" ]; then
                SERVER_IP="$LOCAL_IP"
                log "🏠 Using local IP: $SERVER_IP"
            fi
        fi
    fi
    
    # Create .env file if it doesn't exist
    if [ ! -f "$SCRIPT_DIR/.env" ]; then
        cat > "$SCRIPT_DIR/.env" << EOF
# Database Configuration
DB_HOST=db
DB_PORT=5432
DB_NAME=config_management
DB_USER=postgres
DB_PASSWORD=password123

# API Configuration
API_PORT=5005
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NODE_ENV=production

# Frontend Configuration
FRONTEND_URL=http://$SERVER_IP:3000
NEXT_PUBLIC_API_URL=http://$SERVER_IP:5005/api

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379

# Default Admin User (created on first run)
DEFAULT_ADMIN_EMAIL=admin@pulse.dev
DEFAULT_ADMIN_PASSWORD=password123
DEFAULT_ORGANIZATION=Pulse

# MDM Configuration
MDM_ENABLED=true
MDM_AUTO_GENERATE_KEY=true

# CORS Configuration for self-hosted deployments
ALLOW_SELF_HOSTED_CORS=true
EOF
        log "✅ Created .env file with default configuration"
    else
        log "✅ Using existing .env file"
    fi
    
    # Create or update web .env file for frontend
    log "Configuring web .env file..."
    mkdir -p "$SCRIPT_DIR/apps/web"
    
    # Always update the web .env to ensure correct IP
    cat > "$SCRIPT_DIR/apps/web/.env" << EOF
# Web Application Environment Variables
# Auto-generated by setup.sh

# API URL - Uses detected server IP
NEXT_PUBLIC_API_URL=http://$SERVER_IP:5005/api

# Disable Next.js telemetry
NEXT_TELEMETRY_DISABLED=1
EOF
    log "✅ Updated apps/web/.env file with server IP: $SERVER_IP"
    log "   API URL: http://$SERVER_IP:5005/api"
    
    # Mark that web needs rebuild due to env change
    export WEB_NEEDS_REBUILD=true
    
    # Source the environment variables
    set -a
    source "$SCRIPT_DIR/.env"
    set +a
}

# Prepare Docker Compose
prepare_docker_compose() {
    log "🐳 Preparing Docker Compose configuration..."
    
    # Ensure docker-compose.yml exists and is properly configured
    if [ ! -f "$SCRIPT_DIR/docker-compose.yml" ]; then
        error "docker-compose.yml not found!"
    fi
    
    # Update docker-compose.yml to ensure proper configuration
    # This ensures FRONTEND_URL is set correctly for CORS
    if grep -q "FRONTEND_URL=http://web:3000" "$SCRIPT_DIR/docker-compose.yml"; then
        sed -i.bak 's|FRONTEND_URL=http://web:3000|FRONTEND_URL=http://localhost:3000|g' "$SCRIPT_DIR/docker-compose.yml"
        log "✅ Fixed FRONTEND_URL for proper CORS configuration"
    fi
}

# Build and start services
start_services() {
    log "🚀 Starting services..."
    
    # Stop existing services
    $DOCKER_COMPOSE down -v 2>/dev/null || true
    
    # Build images
    log "Building Docker images..."
    
    # IMPORTANT: Web container must be rebuilt to pick up new NEXT_PUBLIC_API_URL
    if [ "$WEB_NEEDS_REBUILD" = "true" ]; then
        log "📦 Rebuilding web container with new API URL..."
        log "   This is required for the frontend to use the correct server IP"
        $DOCKER_COMPOSE build --no-cache web
    fi
    
    # Build all containers
    $DOCKER_COMPOSE build --no-cache
    
    # Start services
    log "Starting Docker containers..."
    $DOCKER_COMPOSE up -d
    
    # Wait for services to be ready
    log "Waiting for services to be ready..."
    sleep 10
    
    # Check if services are running
    if ! $DOCKER_COMPOSE ps | grep -q "Up"; then
        error "Services failed to start. Check docker-compose logs."
    fi
    
    log "✅ Services started successfully"
    log "   Frontend URL: http://$SERVER_IP:3000"
    log "   API URL: http://$SERVER_IP:5005/api"
}

# Validate database schema
validate_database() {
    log "🗄️ Validating database schema..."
    
    # Wait for database to be fully ready
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if $DOCKER_COMPOSE exec -T db psql -U postgres -d config_management -c "SELECT 1" &>/dev/null; then
            log "✅ Database is ready"
            break
        fi
        attempt=$((attempt + 1))
        log "Waiting for database... ($attempt/$max_attempts)"
        sleep 2
    done
    
    if [ $attempt -eq $max_attempts ]; then
        error "Database failed to start"
    fi
    
    # Apply comprehensive schema fixes
    log "Applying database schema fixes..."
    $DOCKER_COMPOSE exec -T db psql -U postgres -d config_management << 'EOF'
-- Create all required tables for fresh deployment

-- Drop and recreate tables to ensure clean state
DROP TABLE IF EXISTS mdm_commands CASCADE;
DROP TABLE IF EXISTS mdm_devices CASCADE;
DROP TABLE IF EXISTS mdm_profiles CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS user_organizations CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS deployments CASCADE;
DROP TABLE IF EXISTS configurations CASCADE;
DROP TABLE IF EXISTS servers CASCADE;
DROP TABLE IF EXISTS server_groups CASCADE;
DROP TABLE IF EXISTS pem_keys CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS settings CASCADE;

-- Organizations (must be first due to foreign keys)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    organization_id UUID REFERENCES organizations(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Settings
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(255) UNIQUE NOT NULL,
    value TEXT,
    organization_id UUID REFERENCES organizations(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    claude_api_key TEXT
);

-- Server Groups
CREATE TABLE server_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    organization_id UUID REFERENCES organizations(id),
    type VARCHAR(50) DEFAULT 'mixed',
    default_pem_key_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- PEM Keys
CREATE TABLE pem_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    organization_id UUID REFERENCES organizations(id),
    description TEXT,
    public_key TEXT,
    fingerprint VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Servers
CREATE TABLE servers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    hostname VARCHAR(255) NOT NULL,
    organization_id UUID REFERENCES organizations(id),
    port INTEGER NOT NULL DEFAULT 22,
    type VARCHAR(50) NOT NULL DEFAULT 'linux',
    username VARCHAR(255) NOT NULL DEFAULT 'root',
    encrypted_password TEXT,
    operating_system VARCHAR(100),
    os_version VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'unknown',
    last_seen TIMESTAMP,
    group_id UUID REFERENCES server_groups(id),
    pem_key_id UUID REFERENCES pem_keys(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Configurations
CREATE TABLE configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    organization_id UUID REFERENCES organizations(id),
    type VARCHAR(100) NOT NULL DEFAULT 'ansible',
    ansible_playbook TEXT NOT NULL DEFAULT '',
    variables JSONB DEFAULT '{}',
    tags JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    is_template BOOLEAN NOT NULL DEFAULT false,
    version INTEGER NOT NULL DEFAULT 1,
    source VARCHAR(50) NOT NULL DEFAULT 'manual',
    approval_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Deployments
CREATE TABLE deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    organization_id UUID REFERENCES organizations(id),
    configuration_id UUID REFERENCES configurations(id),
    target_type VARCHAR(50) NOT NULL DEFAULT 'server',
    target_id UUID,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    logs TEXT,
    output TEXT,
    error_message TEXT,
    schedule_type VARCHAR(20) DEFAULT 'immediate',
    scheduled_for TIMESTAMP,
    cron_expression VARCHAR(100),
    timezone VARCHAR(50) DEFAULT 'UTC',
    is_active BOOLEAN DEFAULT true,
    next_run_at TIMESTAMP,
    last_run_at TIMESTAMP,
    approval_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    executed_by UUID REFERENCES users(id),
    section VARCHAR(100) DEFAULT 'general',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Roles
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    is_system BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Permissions
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Role Permissions
CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(role_id, permission_id)
);

-- User Roles
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(user_id, role_id)
);

-- User Organizations
CREATE TABLE user_organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(user_id, organization_id)
);

-- MDM Profiles
CREATE TABLE mdm_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    organization_id UUID REFERENCES organizations(id),
    profile_type VARCHAR(50) DEFAULT 'macos',
    enrollment_key VARCHAR(255) UNIQUE NOT NULL,
    allow_remote_commands BOOLEAN DEFAULT true,
    allow_lock_device BOOLEAN DEFAULT true,
    allow_shutdown BOOLEAN DEFAULT false,
    allow_restart BOOLEAN DEFAULT true,
    allow_wake_on_lan BOOLEAN DEFAULT true,
    require_authentication BOOLEAN DEFAULT true,
    max_session_duration INTEGER DEFAULT 3600,
    allowed_ip_ranges JSONB DEFAULT '[]',
    enrollment_expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- MDM Devices
CREATE TABLE mdm_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(255) UNIQUE NOT NULL,
    device_name VARCHAR(255),
    serial_number VARCHAR(255),
    model VARCHAR(255),
    os_version VARCHAR(100),
    architecture VARCHAR(50),
    hostname VARCHAR(255),
    agent_version VARCHAR(50),
    profile_id UUID REFERENCES mdm_profiles(id),
    organization_id UUID REFERENCES organizations(id),
    metadata JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'offline',
    ip_address VARCHAR(45),
    last_seen TIMESTAMP,
    battery_level INTEGER,
    is_charging BOOLEAN,
    agent_install_path TEXT,
    enrolled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    enrolled_by UUID REFERENCES users(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_heartbeat TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- MDM Commands
CREATE TABLE mdm_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES mdm_devices(id),
    organization_id UUID REFERENCES organizations(id),
    command_type VARCHAR(50) NOT NULL,
    command TEXT,
    parameters JSONB DEFAULT '{}',
    timeout INTEGER DEFAULT 300,
    payload JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending',
    output TEXT,
    error_message TEXT,
    exit_code INTEGER,
    initiated_by UUID REFERENCES users(id),
    created_by UUID REFERENCES users(id),
    sent_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create indexes for performance
CREATE INDEX idx_servers_organization_id ON servers(organization_id);
CREATE INDEX idx_servers_status ON servers(status);
CREATE INDEX idx_deployments_status ON deployments(status);
CREATE INDEX idx_deployments_organization_id ON deployments(organization_id);
CREATE INDEX idx_mdm_devices_organization_id ON mdm_devices(organization_id);
CREATE INDEX idx_mdm_devices_status ON mdm_devices(status);
CREATE INDEX idx_configurations_organization_id ON configurations(organization_id);
CREATE INDEX idx_mdm_profiles_enrollment_key ON mdm_profiles(enrollment_key);
CREATE INDEX idx_mdm_devices_device_id ON mdm_devices(device_id);
CREATE INDEX idx_mdm_commands_device_id ON mdm_commands(device_id);
CREATE INDEX idx_mdm_commands_status ON mdm_commands(status);

-- Create update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS \$\$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
\$\$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_servers_updated_at BEFORE UPDATE ON servers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_configurations_updated_at BEFORE UPDATE ON configurations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_deployments_updated_at BEFORE UPDATE ON deployments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mdm_profiles_updated_at BEFORE UPDATE ON mdm_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mdm_devices_updated_at BEFORE UPDATE ON mdm_devices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mdm_commands_updated_at BEFORE UPDATE ON mdm_commands FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create admin organization
INSERT INTO organizations (id, name, description, owner_id) 
VALUES ('462a096d-fdd2-4a54-a8e2-07f404812030', 'Pulse', 'Default admin organization', '2c52e6d2-83f8-4a2e-a8cc-fafa52aba0da');

-- Create admin user
INSERT INTO users (id, email, name, password_hash, role, organization_id) 
VALUES ('2c52e6d2-83f8-4a2e-a8cc-fafa52aba0da', 'admin@pulse.dev', 'Pulse Admin', '\$2a\$10\$nBtB1QVV7KVE6vapl4OP/uDuiZxdg/1XTIdNX.H6mutlorPdtA2y.', 'super_admin', '462a096d-fdd2-4a54-a8e2-07f404812030');

-- Create user organization link
INSERT INTO user_organizations (user_id, organization_id, role) 
VALUES ('2c52e6d2-83f8-4a2e-a8cc-fafa52aba0da', '462a096d-fdd2-4a54-a8e2-07f404812030', 'admin');

-- Create default MDM profile with unique enrollment key
INSERT INTO mdm_profiles (
    name, description, organization_id, enrollment_key, created_by
) VALUES (
    'Default MacOS Profile',
    'Default MDM profile for MacOS devices - automatically created',
    '462a096d-fdd2-4a54-a8e2-07f404812030',
    encode(gen_random_bytes(32), 'hex'),
    '2c52e6d2-83f8-4a2e-a8cc-fafa52aba0da'
);

EOF

    $DOCKER_COMPOSE exec -T db psql -U postgres -d config_management << 'EOF'
-- Comprehensive Database Schema Fix for Fresh Installations

-- Create tables if they don't exist
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    owner_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS server_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    organization_id UUID REFERENCES organizations(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS pem_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    organization_id UUID REFERENCES organizations(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS servers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    hostname VARCHAR(255) NOT NULL,
    organization_id UUID REFERENCES organizations(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    organization_id UUID REFERENCES organizations(id),
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    organization_id UUID REFERENCES organizations(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    is_system BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(user_id, role_id)
);

CREATE TABLE IF NOT EXISTS user_organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(user_id, organization_id)
);

CREATE TABLE IF NOT EXISTS mdm_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    organization_id UUID REFERENCES organizations(id),
    profile_type VARCHAR(50) DEFAULT 'macos',
    enrollment_key VARCHAR(255) UNIQUE NOT NULL,
    allow_remote_commands BOOLEAN DEFAULT true,
    allow_lock_device BOOLEAN DEFAULT true,
    allow_shutdown BOOLEAN DEFAULT false,
    allow_restart BOOLEAN DEFAULT true,
    allow_wake_on_lan BOOLEAN DEFAULT true,
    require_authentication BOOLEAN DEFAULT true,
    max_session_duration INTEGER DEFAULT 3600,
    allowed_ip_ranges JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS mdm_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(255) UNIQUE NOT NULL,
    device_name VARCHAR(255),
    serial_number VARCHAR(255),
    model VARCHAR(255),
    os_version VARCHAR(100),
    architecture VARCHAR(50),
    hostname VARCHAR(255),
    agent_version VARCHAR(50),
    profile_id UUID REFERENCES mdm_profiles(id),
    organization_id UUID REFERENCES organizations(id),
    metadata JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'offline',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS mdm_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES mdm_devices(id),
    command_type VARCHAR(50) NOT NULL,
    payload JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending',
    output TEXT,
    error TEXT,
    created_by UUID REFERENCES users(id),
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Apply all column fixes
ALTER TABLE servers ADD COLUMN IF NOT EXISTS port INTEGER NOT NULL DEFAULT 22;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS type VARCHAR(50) NOT NULL DEFAULT 'linux';
ALTER TABLE servers ADD COLUMN IF NOT EXISTS username VARCHAR(255) NOT NULL DEFAULT 'root';
ALTER TABLE servers ADD COLUMN IF NOT EXISTS encrypted_password TEXT;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS operating_system VARCHAR(100);
ALTER TABLE servers ADD COLUMN IF NOT EXISTS os_version VARCHAR(100);
ALTER TABLE servers ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'unknown';
ALTER TABLE servers ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS group_id UUID;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS pem_key_id UUID;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS metadata JSONB;

ALTER TABLE server_groups ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'mixed';
ALTER TABLE server_groups ADD COLUMN IF NOT EXISTS default_pem_key_id UUID;

ALTER TABLE pem_keys ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE pem_keys ADD COLUMN IF NOT EXISTS public_key TEXT;
ALTER TABLE pem_keys ADD COLUMN IF NOT EXISTS fingerprint VARCHAR(255);

ALTER TABLE configurations ADD COLUMN IF NOT EXISTS type VARCHAR(100) NOT NULL DEFAULT 'ansible';
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS ansible_playbook TEXT NOT NULL DEFAULT '';
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS variables JSONB;
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS tags JSONB;
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS source VARCHAR(50) NOT NULL DEFAULT 'manual';
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) NOT NULL DEFAULT 'pending';
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE deployments ADD COLUMN IF NOT EXISTS configuration_id UUID;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS target_type VARCHAR(50) NOT NULL DEFAULT 'server';
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS target_id UUID;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS logs TEXT;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS output TEXT;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS schedule_type VARCHAR(20) DEFAULT 'immediate';
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS cron_expression VARCHAR(100);
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC';
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMP;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMP;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) NOT NULL DEFAULT 'pending';
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS executed_by UUID;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS section VARCHAR(100) DEFAULT 'general';

ALTER TABLE roles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS created_by UUID;

ALTER TABLE permissions ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS assigned_by UUID;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE user_organizations ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'member';
ALTER TABLE user_organizations ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE user_organizations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP;
ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS battery_level INTEGER;
ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS is_charging BOOLEAN;
ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS agent_install_path TEXT;
ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS enrolled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS enrolled_by UUID;
ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_servers_organization_id ON servers(organization_id);
CREATE INDEX IF NOT EXISTS idx_servers_status ON servers(status);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);
CREATE INDEX IF NOT EXISTS idx_deployments_organization_id ON deployments(organization_id);
CREATE INDEX IF NOT EXISTS idx_mdm_devices_organization_id ON mdm_devices(organization_id);
CREATE INDEX IF NOT EXISTS idx_mdm_devices_status ON mdm_devices(status);
CREATE INDEX IF NOT EXISTS idx_configurations_organization_id ON configurations(organization_id);
CREATE INDEX IF NOT EXISTS idx_mdm_profiles_enrollment_key ON mdm_profiles(enrollment_key);
CREATE INDEX IF NOT EXISTS idx_mdm_devices_device_id ON mdm_devices(device_id);

-- Verify all tables exist
DO $$
DECLARE
    required_tables text[] := ARRAY[
        'organizations', 'users', 'servers', 'server_groups', 'pem_keys',
        'configurations', 'deployments', 'roles', 'permissions',
        'role_permissions', 'user_roles', 'user_organizations',
        'mdm_profiles', 'mdm_devices', 'mdm_commands'
    ];
    tbl text;
BEGIN
    FOREACH tbl IN ARRAY required_tables
    LOOP
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl) THEN
            RAISE EXCEPTION 'Required table % does not exist', tbl;
        END IF;
    END LOOP;
    RAISE NOTICE 'All required tables exist';
END $$;
EOF
    
    if [ $? -eq 0 ]; then
        log "✅ Database schema validated successfully"
    else
        error "Database schema validation failed"
    fi
}

# Wait for API to be ready
wait_for_api() {
    log "⏳ Waiting for API to be ready..."
    
    local max_attempts=60
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s http://localhost:5005/health &>/dev/null; then
            log "✅ API is ready"
            return 0
        fi
        attempt=$((attempt + 1))
        log "Waiting for API... ($attempt/$max_attempts)"
        sleep 2
    done
    
    error "API failed to start. Check logs with: $DOCKER_COMPOSE logs api"
}

# Verify MDM setup
verify_mdm_setup() {
    log "🔐 Verifying MDM setup..."
    
    # Give API extra time to seed data
    sleep 5
    
    # Check if default organization has MDM profile with enrollment key
    local mdm_check=$($DOCKER_COMPOSE exec -T db psql -U postgres -d config_management -t -c "
        SELECT COUNT(*) FROM mdm_profiles WHERE organization_id IN (
            SELECT id FROM organizations WHERE name = 'Pulse'
        );
    " | tr -d ' \t\n\r')
    
    if [ "$mdm_check" -gt 0 ]; then
        log "✅ MDM profile exists for default organization"
        
        # Get and display the enrollment key
        local enrollment_key=$($DOCKER_COMPOSE exec -T db psql -U postgres -d config_management -t -c "
            SELECT enrollment_key FROM mdm_profiles WHERE organization_id IN (
                SELECT id FROM organizations WHERE name = 'Pulse'
            ) LIMIT 1;
        " | tr -d ' \t\n\r')
        
        if [ -n "$enrollment_key" ] && [ "$enrollment_key" != "" ]; then
            info "MDM Enrollment Key: $enrollment_key"
            
            # Create MDM installer script with the correct key
            create_mdm_installer "$enrollment_key"
        else
            warning "MDM enrollment key is empty"
        fi
    else
        warning "No MDM profile found. It will be created on first admin login."
    fi
}

# Create MDM installer script
create_mdm_installer() {
    local enrollment_key=$1
    local installer_path="$SCRIPT_DIR/mdm-agent-installer.sh"
    
    log "📝 Creating MDM agent installer script..."
    
    # Get server IP - try multiple methods
    local server_ip="localhost"
    if command -v hostname &> /dev/null; then
        local host_ip=$(hostname -I 2>/dev/null | awk '{print $1}' || true)
        if [ -n "$host_ip" ]; then
            server_ip="$host_ip"
        fi
    fi
    
    cat > "$installer_path" << EOF
#!/bin/bash
# Pulse MDM Agent Installer
# Auto-generated with enrollment key for fresh deployment

set -e

ENROLLMENT_KEY="$enrollment_key"
PULSE_SERVER_URL="http://$server_ip:5005/api"

echo "🚀 Installing Pulse MDM Agent"
echo "Server: \$PULSE_SERVER_URL"
echo "Key: \${ENROLLMENT_KEY:0:20}..."

# Create agent directory
AGENT_DIR="\$HOME/.pulse-mdm"
mkdir -p "\$AGENT_DIR"
mkdir -p "\$HOME/Library/LaunchAgents"
mkdir -p "\$HOME/Library/Logs"

# Create the Python agent (inline for standalone deployment)
cat > "\$AGENT_DIR/pulse-agent.py" << 'AGENT_EOF'
#!/usr/bin/env python3
import os
import sys
import time
import json
import socket
import platform
import subprocess
import signal
import uuid
from datetime import datetime

try:
    import requests
except ImportError:
    print("Installing requests module...")
    subprocess.run([sys.executable, "-m", "pip", "install", "requests", "--quiet"], check=False)
    import requests

try:
    import psutil
except ImportError:
    print("Installing psutil module...")
    subprocess.run([sys.executable, "-m", "pip", "install", "psutil", "--quiet"], check=False)
    import psutil

# Configuration
ENROLLMENT_KEY = os.environ.get('PULSE_ENROLLMENT_KEY', '')
SERVER_URL = os.environ.get('PULSE_SERVER_URL', 'http://localhost:5005/api')
HEARTBEAT_INTERVAL = 30

def log(message):
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    log_msg = f"[{timestamp}] {message}"
    print(log_msg)
    try:
        with open(os.path.expanduser('~/Library/Logs/pulse-agent.log'), 'a') as f:
            f.write(log_msg + '\\n')
    except:
        pass

def get_device_id():
    id_file = os.path.expanduser('~/.pulse-mdm/device_id')
    if os.path.exists(id_file):
        with open(id_file, 'r') as f:
            return f.read().strip()
    
    device_id = str(uuid.uuid4())
    os.makedirs(os.path.dirname(id_file), exist_ok=True)
    with open(id_file, 'w') as f:
        f.write(device_id)
    return device_id

def get_device_info():
    try:
        # Get serial number
        serial = 'UNKNOWN'
        try:
            result = subprocess.run(['system_profiler', 'SPHardwareDataType'], 
                                  capture_output=True, text=True, timeout=5)
            for line in result.stdout.split('\\n'):
                if 'Serial Number' in line:
                    serial = line.split(':')[1].strip()
                    break
        except:
            pass
        
        # Get IP address
        ip_address = socket.gethostbyname(socket.gethostname())
        
        # Get battery info
        battery = psutil.sensors_battery()
        battery_level = int(battery.percent) if battery else None
        is_charging = battery.power_plugged if battery else None
        
        return {
            'deviceName': socket.gethostname(),
            'deviceId': get_device_id(),
            'serialNumber': serial,
            'model': platform.machine(),
            'osVersion': platform.mac_ver()[0] if platform.system() == 'Darwin' else platform.version(),
            'architecture': platform.machine(),
            'hostname': socket.getfqdn(),
            'agentVersion': '1.0.0',
            'metadata': {
                'ipAddress': ip_address,
                'batteryLevel': battery_level,
                'isCharging': is_charging
            }
        }
    except Exception as e:
        log(f"Error getting device info: {e}")
        return {
            'deviceName': socket.gethostname(),
            'deviceId': get_device_id(),
            'osVersion': platform.version(),
            'agentVersion': '1.0.0'
        }

def enroll_device():
    log("Enrolling device...")
    
    device_info = get_device_info()
    device_info['enrollmentKey'] = ENROLLMENT_KEY
    
    try:
        response = requests.post(
            f"{SERVER_URL}/mdm/enroll",
            json=device_info,
            timeout=10
        )
        
        if response.status_code in [200, 201]:
            log("✅ Device enrolled successfully")
            return True
        elif response.status_code == 409:
            log("Device already enrolled")
            return True
        else:
            log(f"❌ Enrollment failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        log(f"❌ Enrollment error: {e}")
        return False

def send_heartbeat():
    device_info = get_device_info()
    device_info['status'] = 'online'
    
    try:
        response = requests.post(
            f"{SERVER_URL}/mdm/devices/{get_device_id()}/heartbeat",
            json=device_info,
            headers={'X-Enrollment-Key': ENROLLMENT_KEY},
            timeout=5
        )
        
        if response.status_code == 200:
            return True
        else:
            log(f"Heartbeat failed: {response.status_code}")
            return False
    except Exception as e:
        log(f"Heartbeat error: {e}")
        return False

def check_commands():
    try:
        response = requests.get(
            f"{SERVER_URL}/mdm/devices/{get_device_id()}/commands/pending",
            headers={'X-Enrollment-Key': ENROLLMENT_KEY},
            timeout=5
        )
        
        if response.status_code == 200:
            commands = response.json()
            for command in commands:
                execute_command(command)
    except Exception as e:
        log(f"Error checking commands: {e}")

def execute_command(command):
    log(f"Executing command: {command.get('commandType')}")
    
    command_id = command['id']
    command_type = command['commandType']
    
    try:
        if command_type == 'lock':
            try:
                subprocess.run(['pmset', 'displaysleepnow'], check=True)
                report_command(command_id, 'completed', 'Display turned off')
            except:
                try:
                    subprocess.run(['osascript', '-e', 'tell application "System Events" to start current screen saver'], check=True)
                    report_command(command_id, 'completed', 'Screen saver started')
                except:
                    report_command(command_id, 'failed', 'Could not lock screen')
        
        elif command_type == 'wake':
            subprocess.run(['caffeinate', '-u', '-t', '2'])
            report_command(command_id, 'completed', 'Display awakened')
        
        else:
            report_command(command_id, 'failed', f'Unknown command: {command_type}')
    
    except Exception as e:
        report_command(command_id, 'failed', str(e))

def report_command(command_id, status, output):
    try:
        requests.put(
            f"{SERVER_URL}/mdm/commands/{command_id}/status",
            json={
                'status': status,
                'output': output,
                'completedAt': datetime.now().isoformat()
            },
            headers={'X-Enrollment-Key': ENROLLMENT_KEY},
            timeout=5
        )
    except:
        pass

def signal_handler(signum, frame):
    log("Agent stopping...")
    sys.exit(0)

def main():
    log("🚀 Pulse MDM Agent starting...")
    log(f"Server: {SERVER_URL}")
    log(f"Device ID: {get_device_id()}")
    
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    
    # Initial enrollment
    enrolled = enroll_device()
    if not enrolled:
        log("Waiting 30s before retry...")
        time.sleep(30)
    
    # Main loop
    last_heartbeat = 0
    while True:
        try:
            current_time = time.time()
            
            if current_time - last_heartbeat >= HEARTBEAT_INTERVAL:
                if not enrolled:
                    enrolled = enroll_device()
                
                if enrolled and send_heartbeat():
                    check_commands()
                
                last_heartbeat = current_time
            
            time.sleep(5)
            
        except KeyboardInterrupt:
            break
        except Exception as e:
            log(f"Error: {e}")
            time.sleep(30)
    
    log("Agent stopped")

if __name__ == '__main__':
    main()
AGENT_EOF

# Make executable
chmod +x "\$AGENT_DIR/pulse-agent.py"

# Create LaunchAgent plist
cat > "\$HOME/Library/LaunchAgents/com.pulse.mdm.plist" << PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.pulse.mdm</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>\$AGENT_DIR/pulse-agent.py</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PULSE_ENROLLMENT_KEY</key>
        <string>\$ENROLLMENT_KEY</string>
        <key>PULSE_SERVER_URL</key>
        <string>\$PULSE_SERVER_URL</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>\$HOME/Library/Logs/pulse-agent-out.log</string>
    <key>StandardErrorPath</key>
    <string>\$HOME/Library/Logs/pulse-agent-err.log</string>
</dict>
</plist>
PLIST_EOF

# Load the agent
echo "Starting agent..."
launchctl unload "\$HOME/Library/LaunchAgents/com.pulse.mdm.plist" 2>/dev/null || true
launchctl load "\$HOME/Library/LaunchAgents/com.pulse.mdm.plist"

# Verify
sleep 3
if launchctl list | grep -q "com.pulse.mdm"; then
    echo "✅ Pulse MDM agent installed and running!"
    echo ""
    echo "Commands:"
    echo "  Check status: launchctl list | grep pulse"
    echo "  View logs: tail -f ~/Library/Logs/pulse-agent.log"
    echo "  Stop: launchctl unload ~/Library/LaunchAgents/com.pulse.mdm.plist"
    echo ""
    tail -5 ~/Library/Logs/pulse-agent.log 2>/dev/null || true
else
    echo "❌ Agent failed to start"
    echo "Check: ~/Library/Logs/pulse-agent-err.log"
    exit 1
fi
EOF
    
    chmod +x "$installer_path"
    log "✅ MDM installer script created at: $installer_path"
}

# Display final instructions
display_instructions() {
    log "🎉 Setup completed successfully!"
    
    echo ""
    echo "============================================"
    echo "  Pulse Configuration Management System"
    echo "============================================"
    echo ""
    echo "📌 Access Information:"
    echo "-------------------------------------------"
    echo "Web Interface:    http://$SERVER_IP:3000"
    echo "API Endpoint:     http://$SERVER_IP:5005"
    if [ "$SERVER_IP" != "localhost" ]; then
        echo "Local Access:     http://localhost:3000"
        echo "Note: CORS is configured for self-hosted deployment"
    fi
    echo ""
    echo "🔐 Default Admin Credentials:"
    echo "-------------------------------------------"
    echo "Email:           admin@pulse.dev"
    echo "Password:        password123"
    echo ""
    echo "🐳 Docker Commands:"
    echo "-------------------------------------------"
    echo "View logs:       $DOCKER_COMPOSE logs -f"
    echo "Stop services:   $DOCKER_COMPOSE down"
    echo "Start services:  $DOCKER_COMPOSE up -d"
    echo "Restart:         $DOCKER_COMPOSE restart"
    echo ""
    echo "📱 MDM Agent Installation:"
    echo "-------------------------------------------"
    echo "Installer:       ./mdm-agent-installer.sh"
    echo ""
    echo "🔍 Troubleshooting:"
    echo "-------------------------------------------"
    echo "Check API logs:  $DOCKER_COMPOSE logs api"
    echo "Check DB:        $DOCKER_COMPOSE exec db psql -U postgres -d config_management"
    echo "Check Redis:     $DOCKER_COMPOSE exec redis redis-cli"
    echo ""
    echo "📚 Documentation:"
    echo "-------------------------------------------"
    echo "README:          ./README.md"
    echo "Setup Log:       ./setup.log"
    echo ""
    echo "============================================"
}

# Health check
health_check() {
    log "🏥 Running health check..."
    
    local all_healthy=true
    
    # Check database
    if $DOCKER_COMPOSE exec -T db psql -U postgres -d config_management -c "SELECT 1" &>/dev/null; then
        log "✅ Database: Healthy"
    else
        warning "Database: Not responding"
        all_healthy=false
    fi
    
    # Check API
    if curl -s http://localhost:5005/health &>/dev/null; then
        log "✅ API: Healthy"
    else
        warning "API: Not responding"
        all_healthy=false
    fi
    
    # Check Web
    if curl -s http://localhost:3000 &>/dev/null; then
        log "✅ Web Interface: Healthy"
    else
        warning "Web Interface: Not responding"
        all_healthy=false
    fi
    
    # Check Redis
    if $DOCKER_COMPOSE exec -T redis redis-cli ping &>/dev/null; then
        log "✅ Redis: Healthy"
    else
        warning "Redis: Not responding"
        all_healthy=false
    fi
    
    if [ "$all_healthy" = true ]; then
        log "✅ All services are healthy!"
    else
        warning "Some services are not healthy. Check logs for details."
    fi
}

# Main execution
main() {
    echo ""
    echo "============================================"
    echo "  Pulse Configuration Management Setup"
    echo "============================================"
    echo ""
    
    # Initialize log file
    echo "Setup started at $(date)" > "$LOG_FILE"
    
    # Run setup steps
    check_prerequisites
    setup_environment
    prepare_docker_compose
    start_services
    validate_database
    wait_for_api
    
    # Give services time to fully initialize and seed data
    log "Waiting for services to fully initialize..."
    sleep 10
    
    verify_mdm_setup
    health_check
    display_instructions
    
    log "Setup completed at $(date)"
}

# Handle script interruption
trap 'error "Setup interrupted by user"' INT TERM

# Run main function
main "$@"
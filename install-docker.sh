#!/bin/bash

# Quick Docker Installation Script for Ubuntu/Debian
# Run with: sudo bash install-docker.sh

set -e

echo "=============================================="
echo "         Docker Installation Script"
echo "=============================================="
echo ""

if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run this script as root: sudo bash install-docker.sh"
    exit 1
fi

echo "🐳 Installing Docker..."

# Update package index
apt-get update

# Install required packages
apt-get install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up the repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update package index again
apt-get update

# Install Docker Engine, CLI, containerd, and Docker Compose plugin
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Start and enable Docker
systemctl start docker
systemctl enable docker

# Add current user to docker group (if not root)
if [ "$SUDO_USER" ]; then
    usermod -aG docker "$SUDO_USER"
    echo "✅ Added $SUDO_USER to docker group"
fi

# Test Docker installation
docker --version
docker compose version

echo ""
echo "✅ Docker installation completed successfully!"
echo ""
echo "📝 Next steps:"
echo "   1. If you added a user to docker group, log out and back in"
echo "   2. Or run the setup script with sudo: sudo bash setup.sh"
echo ""
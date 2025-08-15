#!/bin/bash
set -e

echo "🚀 Installing Pulse MDM Agent"
echo "📱 Enrollment Key: YOUR_ENROLLMENT_KEY"
echo "🌐 Server URL: http://localhost:5005/api"

# Create agent directory
AGENT_DIR="$HOME/.pulse-mdm"
mkdir -p "$AGENT_DIR"

# Download the agent script
echo "⬇️ Downloading agent..."
cat > "$AGENT_DIR/agent.sh" << 'AGENT_EOF'
#!/bin/bash
ENROLLMENT_KEY="YOUR_ENROLLMENT_KEY"
SERVER_URL="http://localhost:5005/api"

echo "🔐 Enrolling device with key: $ENROLLMENT_KEY"

# Get device info
DEVICE_NAME=$(hostname)
DEVICE_ID=$(uname -n)
SERIAL_NUMBER=$(system_profiler SPHardwareDataType 2>/dev/null | grep "Serial Number" | awk '{print $4}' || echo "unknown")
MODEL=$(system_profiler SPHardwareDataType 2>/dev/null | grep "Model Name" | cut -d: -f2 | xargs || echo "unknown")
OS_VERSION=$(sw_vers -productVersion 2>/dev/null || uname -r)
ARCHITECTURE=$(uname -m)

# Enroll device
curl -X POST "$SERVER_URL/mdm/enroll" \
  -H "Content-Type: application/json" \
  -d "{
    \"enrollmentKey\": \"$ENROLLMENT_KEY\",
    \"deviceName\": \"$DEVICE_NAME\",
    \"deviceId\": \"$DEVICE_ID\",
    \"serialNumber\": \"$SERIAL_NUMBER\",
    \"model\": \"$MODEL\",
    \"osVersion\": \"$OS_VERSION\",
    \"architecture\": \"$ARCHITECTURE\"
  }" && echo "✅ Device enrolled successfully!" || echo "❌ Enrollment failed"

AGENT_EOF

chmod +x "$AGENT_DIR/agent.sh"

echo "✅ Agent installed to $AGENT_DIR/agent.sh"
echo "🚀 Running enrollment..."
"$AGENT_DIR/agent.sh"

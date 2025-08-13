import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { mdmProfiles } from '@config-management/database';

interface ProfileConfig {
  profileId: string;
  profileName: string;
  organizationName: string;
  enrollmentKey: string;
  serverUrl: string;
  allowRemoteCommands: boolean;
  allowLockDevice: boolean;
  allowShutdown: boolean;
  allowRestart: boolean;
}

export class MDMProfileGenerator {
  /**
   * Generate a .mobileconfig profile for macOS MDM enrollment
   */
  static generateMobileConfig(config: ProfileConfig): string {
    const profileUUID = uuidv4().toUpperCase();
    const payloadUUID = uuidv4().toUpperCase();
    const installScriptUUID = uuidv4().toUpperCase();
    
    // Create the installation script that will be embedded in the profile
    const installScript = `#!/bin/bash
# ConfigMaster MDM Agent Auto-Installer
set -e

# Configuration from profile
ENROLLMENT_KEY="${config.enrollmentKey}"
SERVER_URL="${config.serverUrl}"
PROFILE_ID="${config.profileId}"

# Create temporary directory
TEMP_DIR="/tmp/configmaster-mdm-install"
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

# Download the agent installer
echo "Downloading ConfigMaster MDM agent..."
curl -L -o install.sh "${config.serverUrl}/mdm/download/agent-installer" || {
  echo "Failed to download agent installer"
  exit 1
}

# Make it executable
chmod +x install.sh

# Run the installer with the enrollment key
echo "Installing ConfigMaster MDM agent..."
sudo ./install.sh "$ENROLLMENT_KEY" "$SERVER_URL" || {
  echo "Failed to install agent"
  exit 1
}

# Clean up
cd /
rm -rf "$TEMP_DIR"

echo "ConfigMaster MDM agent installed successfully"
`;

    // Escape special characters in strings to prevent XML issues
    const escapeXml = (unsafe: string) => {
      return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '&': return '&amp;';
          case '\'': return '&apos;';
          case '"': return '&quot;';
          default: return c;
        }
      });
    };

    const mobileConfig = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadDisplayName</key>
    <string>Pulse MDM - ${escapeXml(config.organizationName)}</string>
    <key>PayloadDescription</key>
    <string>Mobile Device Management configuration for ${escapeXml(config.organizationName)}. This profile enables remote device management capabilities.</string>
    <key>PayloadIdentifier</key>
    <string>com.pulse.mdm.${config.profileId}</string>
    <key>PayloadOrganization</key>
    <string>${escapeXml(config.organizationName)}</string>
    <key>PayloadScope</key>
    <string>System</string>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>${profileUUID}</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
    <key>PayloadRemovalDisallowed</key>
    <false/>
    <key>ConsentText</key>
    <dict>
        <key>default</key>
        <string>Pulse MDM Setup Instructions:

After installing this profile, run this command in Terminal to complete the setup:

curl -L -o /tmp/install-mdm.sh "${config.serverUrl}/mdm/download/agent-installer" &amp;&amp; chmod +x /tmp/install-mdm.sh &amp;&amp; sudo /tmp/install-mdm.sh "${config.enrollmentKey}" "${config.serverUrl}"

This will install the Pulse MDM agent to enable remote device management.</string>
    </dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>PayloadDisplayName</key>
            <string>Pulse MDM Configuration</string>
            <key>PayloadDescription</key>
            <string>Basic configuration for Pulse MDM system</string>
            <key>PayloadIdentifier</key>
            <string>com.pulse.mdm.config.${config.profileId}</string>
            <key>PayloadType</key>
            <string>com.apple.ManagedClient.preferences</string>
            <key>PayloadUUID</key>
            <string>${payloadUUID}</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
            <key>PayloadContent</key>
            <dict>
                <key>com.pulse.mdm</key>
                <dict>
                    <key>Forced</key>
                    <array>
                        <dict>
                            <key>mcx_preference_settings</key>
                            <dict>
                                <key>server_url</key>
                                <string>${config.serverUrl}</string>
                                <key>enrollment_key</key>
                                <string>${config.enrollmentKey}</string>
                                <key>organization</key>
                                <string>${escapeXml(config.organizationName)}</string>
                            </dict>
                        </dict>
                    </array>
                </dict>
            </dict>
        </dict>
    </array>
</dict>
</plist>`;

    return mobileConfig;
  }

  /**
   * Generate a combined installer package that includes both the profile and agent
   */
  static generateInstallerPackage(config: ProfileConfig): string {
    const packageScript = `#!/bin/bash
# Pulse MDM Quick Setup Script
# This script installs both the MDM profile and agent

set -e

ENROLLMENT_KEY="${config.enrollmentKey}"
SERVER_URL="${config.serverUrl}"
PROFILE_NAME="${config.profileName}"
ORG_NAME="${config.organizationName}"

echo "================================================"
echo "Pulse MDM Setup"
echo "Organization: $ORG_NAME"
echo "Profile: $PROFILE_NAME"
echo "================================================"
echo ""

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This installer is only for macOS systems"
    exit 1
fi

# Check for admin privileges
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run this script with sudo privileges"
    echo "Usage: sudo ./install-mdm.sh"
    exit 1
fi

echo "📱 Step 1: Downloading MDM profile..."
PROFILE_FILE="/tmp/configmaster-mdm.mobileconfig"
curl -L -o "$PROFILE_FILE" \\
  "${config.serverUrl}/mdm/profiles/${config.profileId}/download" || {
    echo "❌ Failed to download MDM profile"
    exit 1
}

echo "✅ Profile downloaded successfully"
echo ""

echo "📦 Step 2: Installing MDM profile..."
echo "⚠️  You may be prompted to enter your password and approve the profile installation"
echo ""

# Install the profile
profiles install -path="$PROFILE_FILE" || {
    # If profiles command fails, try opening it for manual installation
    echo "⚠️  Automatic installation failed. Opening profile for manual installation..."
    open "$PROFILE_FILE"
    echo ""
    echo "Please follow these steps:"
    echo "1. System Preferences will open"
    echo "2. Click on 'Profiles' in the notification"
    echo "3. Click 'Install' for the Pulse MDM profile"
    echo "4. Enter your password when prompted"
    echo ""
    read -p "Press Enter after you've installed the profile..."
}

echo ""
echo "🤖 Step 3: Installing MDM agent..."

# Create agent directory
AGENT_DIR="/usr/local/bin"
mkdir -p "$AGENT_DIR"

# Download and install the agent
TEMP_DIR="/tmp/configmaster-mdm-install"
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

# Download agent installer
curl -L -o install.sh "${config.serverUrl}/mdm/download/agent-installer" || {
    echo "❌ Failed to download agent installer"
    exit 1
}

chmod +x install.sh

# Run the agent installer
./install.sh "$ENROLLMENT_KEY" "$SERVER_URL" || {
    echo "❌ Failed to install agent"
    exit 1
}

# Clean up
cd /
rm -rf "$TEMP_DIR"
rm -f "$PROFILE_FILE"

echo ""
echo "================================================"
echo "✅ Pulse MDM Setup Complete!"
echo "================================================"
echo ""
echo "Your Mac is now enrolled in MDM and can be managed remotely."
echo ""
echo "What's been configured:"
echo "  ✓ MDM profile installed"
echo "  ✓ MDM agent installed and running"
echo "  ✓ Device enrolled with organization"
echo "  ✓ Remote management enabled"
echo ""
echo "The MDM agent is running in the background and will:"
echo "  • Send device status updates every 30 seconds"
echo "  • Check for remote commands every 10 seconds"
echo "  • Start automatically on system boot"
echo ""
echo "To verify the agent is running:"
echo "  sudo launchctl list | grep configmaster"
echo ""
echo "To view agent logs:"
echo "  tail -f /tmp/configmaster-mdm.log"
echo ""
`;

    return packageScript;
  }

  /**
   * Sign the mobile config profile (optional, for production use)
   */
  static signProfile(profileContent: string, certificatePath?: string): string {
    // In production, you would sign the profile with an Apple Developer certificate
    // For now, we'll return the unsigned profile
    // Signing prevents the "This profile is not signed" warning
    
    // Example signing command (requires certificate):
    // openssl smime -sign -in profile.mobileconfig -out signed.mobileconfig \
    //   -signer certificate.pem -certfile chain.pem -outform der -nodetach
    
    return profileContent;
  }
}
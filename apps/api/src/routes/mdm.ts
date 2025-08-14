import { Router } from 'express';
import { db } from '../index';
import { mdmProfiles, mdmDevices, mdmCommands, mdmSessions, organizations } from '@config-management/database';
import { eq, and, desc } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth';
import Joi from 'joi';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { MDMProfileGenerator } from '../services/mdmProfileGenerator';

const router = Router();
const publicRouter = Router();

// Temporary token storage (in production, use Redis or database)
interface DownloadToken {
  profileId: string;
  organizationId: string;
  expires: Date;
  type: string;
}

declare global {
  var downloadTokens: Map<string, DownloadToken> | undefined;
}

// Validation schemas
const profileSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().allow('').optional(),
  profileType: Joi.string().valid('macos', 'windows', 'ios', 'android').default('macos'),
  allowRemoteCommands: Joi.boolean().default(true),
  allowLockDevice: Joi.boolean().default(true),
  allowShutdown: Joi.boolean().default(false),
  allowRestart: Joi.boolean().default(true),
  allowWakeOnLan: Joi.boolean().default(true),
  requireAuthentication: Joi.boolean().default(true),
  maxSessionDuration: Joi.number().min(300).max(86400).default(3600),
  allowedIpRanges: Joi.array().items(Joi.string()).default([]),
  enrollmentExpiresAt: Joi.date().iso().optional(),
});

const deviceEnrollmentSchema = Joi.object({
  enrollmentKey: Joi.string().optional(), // Optional for direct agent enrollment
  deviceName: Joi.string().required(),
  deviceId: Joi.string().required(),
  serialNumber: Joi.string().optional(),
  model: Joi.string().optional(),
  osVersion: Joi.string().optional(),
  architecture: Joi.string().valid('arm64', 'x86_64').optional(),
  macAddress: Joi.string().optional(),
  hostname: Joi.string().optional(),
  agentVersion: Joi.string().optional(),
  agentInstallPath: Joi.string().optional(),
  metadata: Joi.object().optional(),
});

const commandSchema = Joi.object({
  commandType: Joi.string().valid('lock', 'unlock', 'shutdown', 'restart', 'wake', 'custom').required(),
  command: Joi.string().when('commandType', {
    is: 'custom',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  parameters: Joi.object().optional(),
  timeout: Joi.number().min(30).max(3600).default(300),
});

// Helper function to generate enrollment key
function generateEnrollmentKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Get Organization's Default Enrollment Key
router.get('/enrollment-key', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    // Get the first active MDM profile for the organization (default profile)
    const profile = await db
      .select({
        enrollmentKey: mdmProfiles.enrollmentKey,
        name: mdmProfiles.name,
        id: mdmProfiles.id,
      })
      .from(mdmProfiles)
      .where(eq(mdmProfiles.organizationId, req.user!.organizationId))
      .limit(1);

    if (profile[0]) {
      res.json({
        enrollmentKey: profile[0].enrollmentKey,
        profileName: profile[0].name,
        profileId: profile[0].id,
      });
    } else {
      res.status(404).json({ error: 'No MDM profile found for organization' });
    }
  } catch (error) {
    console.error('Error getting enrollment key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// MDM Profiles Management
router.get('/profiles', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const profiles = await db
      .select({
        id: mdmProfiles.id,
        name: mdmProfiles.name,
        description: mdmProfiles.description,
        profileType: mdmProfiles.profileType,
        allowRemoteCommands: mdmProfiles.allowRemoteCommands,
        allowLockDevice: mdmProfiles.allowLockDevice,
        allowShutdown: mdmProfiles.allowShutdown,
        allowRestart: mdmProfiles.allowRestart,
        allowWakeOnLan: mdmProfiles.allowWakeOnLan,
        requireAuthentication: mdmProfiles.requireAuthentication,
        maxSessionDuration: mdmProfiles.maxSessionDuration,
        allowedIpRanges: mdmProfiles.allowedIpRanges,
        enrollmentKey: mdmProfiles.enrollmentKey,
        enrollmentExpiresAt: mdmProfiles.enrollmentExpiresAt,
        isActive: mdmProfiles.isActive,
        createdAt: mdmProfiles.createdAt,
        updatedAt: mdmProfiles.updatedAt,
      })
      .from(mdmProfiles)
      .where(eq(mdmProfiles.organizationId, req.user!.organizationId))
      .orderBy(desc(mdmProfiles.createdAt));

    res.json(profiles);
  } catch (error) {
    console.error('Error fetching MDM profiles:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/profiles', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { error, value } = profileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const enrollmentKey = generateEnrollmentKey();

    const newProfile = await db
      .insert(mdmProfiles)
      .values({
        ...value,
        enrollmentKey,
        organizationId: req.user!.organizationId,
        createdBy: req.user!.id,
      })
      .returning();

    res.status(201).json(newProfile[0]);
  } catch (error) {
    console.error('Error creating MDM profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/profiles/:id', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { error, value } = profileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const existingProfile = await db
      .select()
      .from(mdmProfiles)
      .where(
        and(
          eq(mdmProfiles.id, req.params.id),
          eq(mdmProfiles.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!existingProfile[0]) {
      return res.status(404).json({ error: 'MDM profile not found' });
    }

    const updatedProfile = await db
      .update(mdmProfiles)
      .set({
        ...value,
        updatedAt: new Date(),
      })
      .where(eq(mdmProfiles.id, req.params.id))
      .returning();

    res.json(updatedProfile[0]);
  } catch (error) {
    console.error('Error updating MDM profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/profiles/:id', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const existingProfile = await db
      .select()
      .from(mdmProfiles)
      .where(
        and(
          eq(mdmProfiles.id, req.params.id),
          eq(mdmProfiles.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!existingProfile[0]) {
      return res.status(404).json({ error: 'MDM profile not found' });
    }

    await db.delete(mdmProfiles).where(eq(mdmProfiles.id, req.params.id));

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting MDM profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Device Management
router.get('/devices', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const devices = await db
      .select({
        id: mdmDevices.id,
        profileId: mdmDevices.profileId,
        deviceName: mdmDevices.deviceName,
        deviceId: mdmDevices.deviceId,
        serialNumber: mdmDevices.serialNumber,
        model: mdmDevices.model,
        osVersion: mdmDevices.osVersion,
        architecture: mdmDevices.architecture,
        ipAddress: mdmDevices.ipAddress,
        macAddress: mdmDevices.macAddress,
        hostname: mdmDevices.hostname,
        status: mdmDevices.status,
        lastSeen: mdmDevices.lastSeen,
        lastHeartbeat: mdmDevices.lastHeartbeat,
        batteryLevel: mdmDevices.batteryLevel,
        isCharging: mdmDevices.isCharging,
        agentVersion: mdmDevices.agentVersion,
        enrolledAt: mdmDevices.enrolledAt,
        isActive: mdmDevices.isActive,
        metadata: mdmDevices.metadata,
        profile: {
          id: mdmProfiles.id,
          name: mdmProfiles.name,
          profileType: mdmProfiles.profileType,
        },
      })
      .from(mdmDevices)
      .leftJoin(mdmProfiles, eq(mdmDevices.profileId, mdmProfiles.id))
      .where(eq(mdmDevices.organizationId, req.user!.organizationId))
      .orderBy(desc(mdmDevices.lastSeen));

    // Calculate realtime status based on heartbeat age
    const OFFLINE_THRESHOLD_MINUTES = 5; // Device is offline if no heartbeat for 5 minutes
    const now = new Date();
    
    const devicesWithRealtimeStatus = devices.map(device => {
      let calculatedStatus = device.status;
      
      if (device.lastHeartbeat) {
        const lastHeartbeatTime = new Date(device.lastHeartbeat);
        const minutesSinceHeartbeat = (now.getTime() - lastHeartbeatTime.getTime()) / (1000 * 60);
        
        // If device hasn't sent heartbeat in threshold time, mark as offline
        if (minutesSinceHeartbeat > OFFLINE_THRESHOLD_MINUTES) {
          calculatedStatus = 'offline';
        } else if (device.status === 'offline') {
          // If device was offline but sent recent heartbeat, mark as online
          calculatedStatus = 'online';
        }
      } else if (!device.lastHeartbeat && device.lastSeen) {
        // Fallback to lastSeen if no heartbeat
        const lastSeenTime = new Date(device.lastSeen);
        const minutesSinceSeen = (now.getTime() - lastSeenTime.getTime()) / (1000 * 60);
        
        if (minutesSinceSeen > OFFLINE_THRESHOLD_MINUTES) {
          calculatedStatus = 'offline';
        }
      } else {
        // No heartbeat or lastSeen, mark as offline
        calculatedStatus = 'offline';
      }
      
      return {
        ...device,
        status: calculatedStatus,
      };
    });

    res.json(devicesWithRealtimeStatus);
  } catch (error) {
    console.error('Error fetching MDM devices:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Device enrollment endpoint - PUBLIC ENDPOINT (no profiles required)
publicRouter.post('/enroll', async (req, res): Promise<any> => {
  try {
    const { error, value } = deviceEnrollmentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Determine organization ID based on enrollment key if provided
    let organizationId: string;
    let profileId: string | null = null;

    if (value.enrollmentKey) {
      // Look up profile by enrollment key to get organization
      const profile = await db
        .select()
        .from(mdmProfiles)
        .where(eq(mdmProfiles.enrollmentKey, value.enrollmentKey))
        .limit(1);

      if (profile[0]) {
        organizationId = profile[0].organizationId;
        profileId = profile[0].id;
      } else {
        return res.status(400).json({ error: 'Invalid enrollment key' });
      }
    } else {
      // Default organization for agent-only enrollment (you should change this)
      // In production, you might want to require an enrollment key always
      organizationId = 'eb602306-9701-4b99-845d-371833d9fcd6'; // Default org
    }

    // Check if device already exists
    const existingDevice = await db
      .select()
      .from(mdmDevices)
      .where(eq(mdmDevices.deviceId, value.deviceId))
      .limit(1);

    if (existingDevice[0]) {
      // Update existing device
      const updateData: any = {
        deviceName: value.deviceName,
        serialNumber: value.serialNumber,
        model: value.model,
        osVersion: value.osVersion,
        architecture: value.architecture,
        macAddress: value.macAddress,
        hostname: value.hostname,
        agentVersion: value.agentVersion,
        agentInstallPath: value.agentInstallPath,
        lastHeartbeat: new Date(),
        status: 'online',
        metadata: value.metadata || {},
        updatedAt: new Date(),
        // Update organization and profile if re-enrolling with different key
        organizationId: organizationId,
      };
      
      // Only set profileId if it's not null
      if (profileId !== null) {
        updateData.profileId = profileId;
      }
      
      const updatedDevice = await db
        .update(mdmDevices)
        .set(updateData)
        .where(eq(mdmDevices.id, existingDevice[0].id))
        .returning();

      res.json(updatedDevice[0]);
    } else {
      // Create new device
      const insertData: any = {
        organizationId: organizationId,
        deviceName: value.deviceName,
        deviceId: value.deviceId,
        serialNumber: value.serialNumber,
        model: value.model,
        osVersion: value.osVersion,
        architecture: value.architecture,
        macAddress: value.macAddress,
        hostname: value.hostname,
        agentVersion: value.agentVersion,
        agentInstallPath: value.agentInstallPath,
        lastHeartbeat: new Date(),
        status: 'online',
        metadata: value.metadata || {},
      };
      
      // Only set profileId if it's not null
      if (profileId !== null) {
        insertData.profileId = profileId;
      }
      
      const newDevice = await db
        .insert(mdmDevices)
        .values(insertData)
        .returning();

      res.status(201).json(newDevice[0]);
    }
  } catch (error) {
    console.error('Error enrolling device:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Device heartbeat endpoint - PUBLIC ENDPOINT  
publicRouter.post('/devices/:deviceId/heartbeat', async (req, res): Promise<any> => {
  try {
    const { batteryLevel, isCharging, ipAddress, status } = req.body;

    const device = await db
      .select()
      .from(mdmDevices)
      .where(eq(mdmDevices.deviceId, req.params.deviceId))
      .limit(1);

    if (!device[0]) {
      return res.status(404).json({ error: 'Device not found' });
    }

    await db
      .update(mdmDevices)
      .set({
        lastHeartbeat: new Date(),
        lastSeen: new Date(),
        batteryLevel: batteryLevel || device[0].batteryLevel,
        isCharging: isCharging !== undefined ? isCharging : device[0].isCharging,
        ipAddress: ipAddress || device[0].ipAddress,
        status: status || 'online',
        updatedAt: new Date(),
      })
      .where(eq(mdmDevices.id, device[0].id));

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating device heartbeat:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Command Management
router.post('/devices/:deviceId/commands', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { error, value } = commandSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const device = await db
      .select()
      .from(mdmDevices)
      .where(
        and(
          eq(mdmDevices.deviceId, req.params.deviceId),
          eq(mdmDevices.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!device[0]) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Check permissions - for agent-based devices (no profile), allow all commands
    if (device[0].profileId) {
      // Profile-based device: check profile permissions
      const profile = await db
        .select()
        .from(mdmProfiles)
        .where(eq(mdmProfiles.id, device[0].profileId))
        .limit(1);

      if (!profile[0]) {
        return res.status(400).json({ error: 'Device profile not found' });
      }

      // Check permissions
      const commandType = value.commandType;
      if (
        (commandType === 'lock' && !profile[0].allowLockDevice) ||
        (commandType === 'shutdown' && !profile[0].allowShutdown) ||
        (commandType === 'restart' && !profile[0].allowRestart) ||
        (commandType === 'custom' && !profile[0].allowRemoteCommands)
      ) {
        return res.status(403).json({ error: `Command '${commandType}' not allowed by profile` });
      }
    }
    // Agent-based devices (profileId is null): allow all commands by default

    const newCommand = await db
      .insert(mdmCommands)
      .values({
        deviceId: device[0].id,
        organizationId: req.user!.organizationId,
        commandType: value.commandType,
        command: value.command,
        parameters: value.parameters || {},
        timeout: value.timeout,
        initiatedBy: req.user!.id,
      })
      .returning();

    res.status(201).json(newCommand[0]);
  } catch (error) {
    console.error('Error creating command:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get pending commands for a device (used by agent) - PUBLIC ENDPOINT
publicRouter.get('/devices/:deviceId/commands/pending', async (req, res): Promise<any> => {
  try {
    const device = await db
      .select()
      .from(mdmDevices)
      .where(eq(mdmDevices.deviceId, req.params.deviceId))
      .limit(1);

    if (!device[0]) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const pendingCommands = await db
      .select()
      .from(mdmCommands)
      .where(
        and(
          eq(mdmCommands.deviceId, device[0].id),
          eq(mdmCommands.status, 'pending')
        )
      )
      .orderBy(mdmCommands.createdAt);

    // Mark commands as sent
    if (pendingCommands.length > 0) {
      await db
        .update(mdmCommands)
        .set({
          status: 'sent',
          sentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(mdmCommands.deviceId, device[0].id),
            eq(mdmCommands.status, 'pending')
          )
        );
    }

    res.json(pendingCommands);
  } catch (error) {
    console.error('Error fetching pending commands:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update command status (used by agent) - PUBLIC ENDPOINT
publicRouter.put('/commands/:commandId/status', async (req, res): Promise<any> => {
  try {
    const { status, output, errorMessage, exitCode } = req.body;

    const command = await db
      .select()
      .from(mdmCommands)
      .where(eq(mdmCommands.id, req.params.commandId))
      .limit(1);

    if (!command[0]) {
      return res.status(404).json({ error: 'Command not found' });
    }

    const updateData: any = {
      status,
      output,
      errorMessage,
      exitCode,
      updatedAt: new Date(),
    };

    if (status === 'executing' && !command[0].startedAt) {
      updateData.startedAt = new Date();
    }

    if (['completed', 'failed', 'timeout'].includes(status) && !command[0].completedAt) {
      updateData.completedAt = new Date();
    }

    const updatedCommand = await db
      .update(mdmCommands)
      .set(updateData)
      .where(eq(mdmCommands.id, req.params.commandId))
      .returning();

    res.json(updatedCommand[0]);
  } catch (error) {
    console.error('Error updating command status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get command history for a device
router.get('/devices/:deviceId/commands', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const device = await db
      .select()
      .from(mdmDevices)
      .where(
        and(
          eq(mdmDevices.deviceId, req.params.deviceId),
          eq(mdmDevices.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!device[0]) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const commands = await db
      .select()
      .from(mdmCommands)
      .where(eq(mdmCommands.deviceId, device[0].id))
      .orderBy(desc(mdmCommands.createdAt));

    res.json(commands);
  } catch (error) {
    console.error('Error fetching command history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a device
router.delete('/devices/:deviceId', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const device = await db
      .select()
      .from(mdmDevices)
      .where(
        and(
          eq(mdmDevices.deviceId, req.params.deviceId),
          eq(mdmDevices.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!device[0]) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Delete the device (cascading delete will remove commands and sessions)
    await db.delete(mdmDevices).where(eq(mdmDevices.id, device[0].id));

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting device:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Download Endpoints

// Generate a temporary download token
router.post('/profiles/:id/download-token', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const profile = await db
      .select()
      .from(mdmProfiles)
      .where(
        and(
          eq(mdmProfiles.id, req.params.id),
          eq(mdmProfiles.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!profile[0]) {
      return res.status(404).json({ error: 'MDM profile not found' });
    }

    // Create a temporary download token (valid for 1 hour)
    const downloadToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour

    // Store the token in memory (in production, use Redis or database)
    if (!global.downloadTokens) global.downloadTokens = new Map();
    global.downloadTokens.set(downloadToken, {
      profileId: req.params.id,
      organizationId: req.user!.organizationId,
      expires,
      type: req.body.type || 'profile'
    });

    res.json({ token: downloadToken });
  } catch (error) {
    console.error('Error generating download token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test endpoint 
router.get('/test-installer', async (req, res): Promise<any> => {
  try {
    console.log('🚀 Agent installer download requested');
    
    const enrollmentKey = req.query.key as string || 'YOUR_ENROLLMENT_KEY';
    const serverUrl = req.query.server as string || `${req.protocol}://${req.get('host')}/api`;
    
    const simpleInstaller = `#!/bin/bash
echo "Pulse MDM Agent Installer"
echo "Enrollment Key: ${enrollmentKey}"
echo "Server URL: ${serverUrl}"
echo "This is a test installer"
`;
    
    res.setHeader('Content-Type', 'application/x-shellscript');
    res.setHeader('Content-Disposition', 'attachment; filename="pulse-mdm-agent-install.sh"');
    res.send(simpleInstaller);

  } catch (error) {
    console.error('Error downloading Pulse agent installer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate agent installer script
function generateAgentInstaller(enrollmentKey?: string, serverUrl?: string): string {
  return `#!/bin/bash

# Pulse MDM Agent Installer
# This script installs and configures the Pulse MDM agent

set -e

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m' # No Color

# Configuration
ENROLLMENT_KEY="${enrollmentKey || '$1'}"
PULSE_SERVER_URL="${serverUrl || '$2'}"
AGENT_DIR="$HOME/.pulse-mdm"
INSTALL_DIR="/usr/local/bin"
PLIST_DIR="$HOME/Library/LaunchAgents"
SERVICE_NAME="com.pulse.mdm.agent"

echo -e "${BLUE}🚀 Pulse MDM Agent Installer${NC}"
echo "=================================="

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}❌ This script should not be run as root${NC}"
   echo "Please run as a regular user (the agent will run in user context)"
   exit 1
fi

# Function to detect server URL if not provided
detect_server_url() {
    if [[ -z "$PULSE_SERVER_URL" ]]; then
        echo -e "${YELLOW}🔍 Detecting server URL...${NC}"
        
        # Try common local URLs first
        for url in "http://localhost:5005/api" "http://127.0.0.1:5005/api" "http://host.docker.internal:5005/api"; do
            if curl -s -m 5 "$url/health" >/dev/null 2>&1; then
                PULSE_SERVER_URL="$url"
                echo -e "${GREEN}✅ Found server at: $PULSE_SERVER_URL${NC}"
                break
            fi
        done
        
        if [[ -z "$PULSE_SERVER_URL" ]]; then
            echo -e "${RED}❌ Could not detect server URL${NC}"
            echo "Please provide the server URL as the second parameter:"
            echo "  $0 ENROLLMENT_KEY SERVER_URL"
            echo ""
            echo "Example:"
            echo "  $0 abc123def456 http://your-server:5005/api"
            exit 1
        fi
    fi
}

# Get enrollment key if not provided
get_enrollment_key() {
    if [[ -z "$ENROLLMENT_KEY" ]]; then
        echo -e "${YELLOW}🔑 No enrollment key provided${NC}"
        echo "Please provide your enrollment key as the first parameter:"
        echo "  $0 ENROLLMENT_KEY [SERVER_URL]"
        echo ""
        echo "Example:"
        echo "  $0 abc123def456"
        exit 1
    fi
}

# Detect server URL first
detect_server_url

# Get enrollment key
get_enrollment_key

echo -e "${BLUE}📋 Configuration:${NC}"
echo "  Server: $PULSE_SERVER_URL"
echo "  Key: ${ENROLLMENT_KEY:0:20}..."
echo ""

# Check dependencies
echo -e "${BLUE}🔍 Checking dependencies...${NC}"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is required but not installed${NC}"
    exit 1
fi

# Check pip
if ! python3 -m pip --version &> /dev/null; then
    echo -e "${YELLOW}⚠️ pip not found, installing...${NC}"
    curl https://bootstrap.pypa.io/get-pip.py | python3 - --user
fi

echo -e "${GREEN}✅ Dependencies OK${NC}"

# Create directories
echo -e "${BLUE}📁 Creating directories...${NC}"
mkdir -p "$AGENT_DIR"
mkdir -p "$PLIST_DIR"
mkdir -p "$HOME/Library/Logs"

# Download and install Python dependencies
echo -e "${BLUE}📦 Installing Python dependencies...${NC}"
python3 -m pip install --user requests psutil 2>/dev/null || true

# Create the Python agent
echo -e "${BLUE}🐍 Creating agent script...${NC}"
cat > "$AGENT_DIR/pulse-agent.py" << 'AGENT_EOF'
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
    subprocess.run([sys.executable, "-m", "pip", "install", "--user", "requests"], check=False)
    import requests

try:
    import psutil
except ImportError:
    print("Installing psutil module...")
    subprocess.run([sys.executable, "-m", "pip", "install", "--user", "psutil"], check=False)
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
            f.write(log_msg + '\\\\n')
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
            for line in result.stdout.split('\\\\n'):
                if 'Serial Number' in line:
                    serial = line.split(':')[1].strip()
                    break
        except:
            pass
        
        # Get IP address
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip_address = s.getsockname()[0]
            s.close()
        except:
            ip_address = socket.gethostbyname(socket.gethostname())
        
        # Get battery info
        battery = None
        battery_level = None
        is_charging = None
        try:
            battery = psutil.sensors_battery()
            if battery:
                battery_level = int(battery.percent)
                is_charging = battery.power_plugged
        except:
            pass
        
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
            # Try multiple methods to lock the screen
            try:
                # Method 1: Using pmset (works on most macOS versions)
                subprocess.run(['pmset', 'displaysleepnow'], check=True)
                report_command(command_id, 'completed', 'Display locked using pmset')
            except:
                try:
                    # Method 2: Using osascript to trigger screen saver
                    subprocess.run(['osascript', '-e', 'tell application "System Events" to start current screen saver'], check=True)
                    report_command(command_id, 'completed', 'Screen saver started')
                except:
                    report_command(command_id, 'failed', 'Could not lock screen - no working method found')
        
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

# Make agent executable
chmod +x "$AGENT_DIR/pulse-agent.py"

# Create LaunchAgent plist
echo -e "${BLUE}⚙️ Creating LaunchAgent...${NC}"
cat > "$PLIST_DIR/$SERVICE_NAME.plist" << PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$SERVICE_NAME</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>$AGENT_DIR/pulse-agent.py</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PULSE_ENROLLMENT_KEY</key>
        <string>$ENROLLMENT_KEY</string>
        <key>PULSE_SERVER_URL</key>
        <string>$PULSE_SERVER_URL</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$HOME/Library/Logs/pulse-agent-out.log</string>
    <key>StandardErrorPath</key>
    <string>$HOME/Library/Logs/pulse-agent-err.log</string>
</dict>
</plist>
PLIST_EOF

# Stop any existing agent
echo -e "${BLUE}🛑 Stopping existing agent...${NC}"
launchctl unload "$PLIST_DIR/$SERVICE_NAME.plist" 2>/dev/null || true
pkill -f pulse-agent.py 2>/dev/null || true

# Start the agent
echo -e "${BLUE}🚀 Starting agent...${NC}"
launchctl load "$PLIST_DIR/$SERVICE_NAME.plist"

# Wait and verify
sleep 3

if launchctl list | grep -q "$SERVICE_NAME"; then
    echo ""
    echo -e "${GREEN}✅ Pulse MDM agent installed and running successfully!${NC}"
    echo ""
    echo -e "${BLUE}📋 Useful commands:${NC}"
    echo "  Check status: launchctl list | grep pulse"
    echo "  View logs: tail -f ~/Library/Logs/pulse-agent.log"
    echo "  Stop agent: launchctl unload ~/Library/LaunchAgents/$SERVICE_NAME.plist"
    echo "  Start agent: launchctl load ~/Library/LaunchAgents/$SERVICE_NAME.plist"
    echo ""
    echo -e "${BLUE}📊 Recent activity:${NC}"
    tail -5 ~/Library/Logs/pulse-agent.log 2>/dev/null || echo "No logs yet"
else
    echo ""
    echo -e "${RED}❌ Agent failed to start${NC}"
    echo "Check error logs: cat ~/Library/Logs/pulse-agent-err.log"
    exit 1
fi
`;
}

// Download MDM Profile (.mobileconfig) with token - PUBLIC ENDPOINT
publicRouter.get('/download/:token', async (req, res): Promise<any> => {
  try {
    const token = req.params.token;
    
    // Check if token exists and is valid
    if (!global.downloadTokens) global.downloadTokens = new Map();
    const tokenData = global.downloadTokens.get(token);
    
    if (!tokenData || tokenData.expires < new Date()) {
      return res.status(404).json({ error: 'Download link expired or invalid' });
    }

    // Clean up expired token
    global.downloadTokens.delete(token);

    const profile = await db
      .select({
        id: mdmProfiles.id,
        name: mdmProfiles.name,
        enrollmentKey: mdmProfiles.enrollmentKey,
        allowRemoteCommands: mdmProfiles.allowRemoteCommands,
        allowLockDevice: mdmProfiles.allowLockDevice,
        allowShutdown: mdmProfiles.allowShutdown,
        allowRestart: mdmProfiles.allowRestart,
        organization: {
          name: organizations.name,
        },
      })
      .from(mdmProfiles)
      .leftJoin(organizations, eq(mdmProfiles.organizationId, organizations.id))
      .where(
        and(
          eq(mdmProfiles.id, tokenData.profileId),
          eq(mdmProfiles.organizationId, tokenData.organizationId)
        )
      )
      .limit(1);

    if (!profile[0]) {
      return res.status(404).json({ error: 'MDM profile not found' });
    }

    const profileData = profile[0];
    const serverUrl = `${req.protocol}://${req.get('host')}/api`;
    
    const config = {
      profileId: profileData.id,
      profileName: profileData.name,
      organizationName: profileData.organization?.name || 'Organization',
      enrollmentKey: profileData.enrollmentKey,
      serverUrl,
      allowRemoteCommands: profileData.allowRemoteCommands,
      allowLockDevice: profileData.allowLockDevice,
      allowShutdown: profileData.allowShutdown,
      allowRestart: profileData.allowRestart,
    };

    if (tokenData.type === 'installer') {
      // Download installer script
      const installerScript = MDMProfileGenerator.generateInstallerPackage(config);
      const fileName = `ConfigMaster-MDM-Setup-${profileData.name.replace(/[^a-zA-Z0-9]/g, '-')}.sh`;

      res.setHeader('Content-Type', 'application/x-shellscript');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(installerScript);
    } else if (tokenData.type === 'instructions') {
      // Download instructions
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const instructions = `# ConfigMaster MDM Installation Instructions

## Profile: ${profileData.name}
## Organization: ${profileData.organization?.name || 'Organization'}

### Quick Setup (Recommended)

1. **Download the all-in-one installer:**
   curl -L -o install-mdm.sh "${baseUrl}/api/mdm/profiles/${profileData.id}/download-installer"

2. **Make it executable and run:**
   chmod +x install-mdm.sh
   sudo ./install-mdm.sh

### Manual Setup

#### Option A: MDM Profile Installation

1. **Download the MDM profile:**
   ${baseUrl}/api/mdm/profiles/${profileData.id}/download

2. **Install the profile:**
   - Double-click the downloaded .mobileconfig file
   - Follow the prompts in System Preferences
   - Enter your password when prompted

#### Option B: Agent-Only Installation

1. **Download the agent installer:**
   curl -L -o install.sh "${baseUrl}/api/mdm/download/agent-installer"

2. **Install the agent:**
   chmod +x install.sh
   sudo ./install.sh ${profileData.enrollmentKey} ${baseUrl}/api

### Verification

After installation, verify the agent is running:

\`\`\`bash
sudo launchctl list | grep configmaster
\`\`\`

Check agent logs:

\`\`\`bash
tail -f /tmp/configmaster-mdm.log
\`\`\`

### Troubleshooting

- **Permission Issues**: Make sure you're running with sudo
- **Network Issues**: Verify connectivity to ${baseUrl}
- **Profile Issues**: Check System Preferences > Profiles

### Support

For technical support, contact your IT administrator or refer to the ConfigMaster documentation.
`;

      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="ConfigMaster-MDM-Instructions.txt"`);
      res.send(instructions);
    } else {
      // Download .mobileconfig profile (default)
      const mobileConfig = MDMProfileGenerator.generateMobileConfig(config);
      const fileName = `${profileData.name.replace(/[^a-zA-Z0-9]/g, '-')}.mobileconfig`;

      res.setHeader('Content-Type', 'application/x-apple-aspen-config');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(mobileConfig);
    }

  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Download MDM Profile (.mobileconfig) - Legacy endpoint
router.get('/profiles/:id/download', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const profile = await db
      .select({
        id: mdmProfiles.id,
        name: mdmProfiles.name,
        enrollmentKey: mdmProfiles.enrollmentKey,
        allowRemoteCommands: mdmProfiles.allowRemoteCommands,
        allowLockDevice: mdmProfiles.allowLockDevice,
        allowShutdown: mdmProfiles.allowShutdown,
        allowRestart: mdmProfiles.allowRestart,
        organization: {
          name: organizations.name,
        },
      })
      .from(mdmProfiles)
      .leftJoin(organizations, eq(mdmProfiles.organizationId, organizations.id))
      .where(
        and(
          eq(mdmProfiles.id, req.params.id),
          eq(mdmProfiles.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!profile[0]) {
      return res.status(404).json({ error: 'MDM profile not found' });
    }

    const profileData = profile[0];
    const serverUrl = `${req.protocol}://${req.get('host')}/api`;
    
    const config = {
      profileId: profileData.id,
      profileName: profileData.name,
      organizationName: profileData.organization?.name || 'Organization',
      enrollmentKey: profileData.enrollmentKey,
      serverUrl,
      allowRemoteCommands: profileData.allowRemoteCommands,
      allowLockDevice: profileData.allowLockDevice,
      allowShutdown: profileData.allowShutdown,
      allowRestart: profileData.allowRestart,
    };

    const mobileConfig = MDMProfileGenerator.generateMobileConfig(config);
    const fileName = `${profileData.name.replace(/[^a-zA-Z0-9]/g, '-')}.mobileconfig`;

    res.setHeader('Content-Type', 'application/x-apple-aspen-config');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(mobileConfig);

  } catch (error) {
    console.error('Error generating MDM profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Download Combined Installer Package
router.get('/profiles/:id/download-installer', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const profile = await db
      .select({
        id: mdmProfiles.id,
        name: mdmProfiles.name,
        enrollmentKey: mdmProfiles.enrollmentKey,
        allowRemoteCommands: mdmProfiles.allowRemoteCommands,
        allowLockDevice: mdmProfiles.allowLockDevice,
        allowShutdown: mdmProfiles.allowShutdown,
        allowRestart: mdmProfiles.allowRestart,
        organization: {
          name: organizations.name,
        },
      })
      .from(mdmProfiles)
      .leftJoin(organizations, eq(mdmProfiles.organizationId, organizations.id))
      .where(
        and(
          eq(mdmProfiles.id, req.params.id),
          eq(mdmProfiles.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!profile[0]) {
      return res.status(404).json({ error: 'MDM profile not found' });
    }

    const profileData = profile[0];
    const serverUrl = `${req.protocol}://${req.get('host')}/api`;
    
    const config = {
      profileId: profileData.id,
      profileName: profileData.name,
      organizationName: profileData.organization?.name || 'Organization',
      enrollmentKey: profileData.enrollmentKey,
      serverUrl,
      allowRemoteCommands: profileData.allowRemoteCommands,
      allowLockDevice: profileData.allowLockDevice,
      allowShutdown: profileData.allowShutdown,
      allowRestart: profileData.allowRestart,
    };

    const installerScript = MDMProfileGenerator.generateInstallerPackage(config);
    const fileName = `ConfigMaster-MDM-Setup-${profileData.name.replace(/[^a-zA-Z0-9]/g, '-')}.sh`;

    res.setHeader('Content-Type', 'application/x-shellscript');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(installerScript);

  } catch (error) {
    console.error('Error generating installer package:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Download Installation Instructions
router.get('/profiles/:id/instructions', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const profile = await db
      .select({
        id: mdmProfiles.id,
        name: mdmProfiles.name,
        enrollmentKey: mdmProfiles.enrollmentKey,
        organization: {
          name: organizations.name,
        },
      })
      .from(mdmProfiles)
      .leftJoin(organizations, eq(mdmProfiles.organizationId, organizations.id))
      .where(
        and(
          eq(mdmProfiles.id, req.params.id),
          eq(mdmProfiles.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!profile[0]) {
      return res.status(404).json({ error: 'MDM profile not found' });
    }

    const profileData = profile[0];
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    const instructions = `# ConfigMaster MDM Installation Instructions

## Profile: ${profileData.name}
## Organization: ${profileData.organization?.name || 'Organization'}

### Quick Setup (Recommended)

1. **Download the all-in-one installer:**
   curl -L -o install-mdm.sh "${baseUrl}/api/mdm/profiles/${profileData.id}/download-installer"

2. **Make it executable and run:**
   chmod +x install-mdm.sh
   sudo ./install-mdm.sh

### Manual Setup

#### Option A: MDM Profile Installation

1. **Download the MDM profile:**
   ${baseUrl}/api/mdm/profiles/${profileData.id}/download

2. **Install the profile:**
   - Double-click the downloaded .mobileconfig file
   - Follow the prompts in System Preferences
   - Enter your password when prompted

#### Option B: Agent-Only Installation

1. **Download the agent installer:**
   curl -L -o install.sh "${baseUrl}/api/mdm/download/agent-installer"

2. **Install the agent:**
   chmod +x install.sh
   sudo ./install.sh ${profileData.enrollmentKey} ${baseUrl}/api

### Verification

After installation, verify the agent is running:

\`\`\`bash
sudo launchctl list | grep configmaster
\`\`\`

Check agent logs:

\`\`\`bash
tail -f /tmp/configmaster-mdm.log
\`\`\`

### Troubleshooting

- **Permission Issues**: Make sure you're running with sudo
- **Network Issues**: Verify connectivity to ${baseUrl}
- **Profile Issues**: Check System Preferences > Profiles

### Support

For technical support, contact your IT administrator or refer to the ConfigMaster documentation.
`;

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="ConfigMaster-MDM-Instructions.txt"`);
    res.send(instructions);

  } catch (error) {
    console.error('Error generating instructions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as mdmRoutes, publicRouter as mdmPublicRoutes };
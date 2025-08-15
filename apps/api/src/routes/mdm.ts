import { Router } from 'express';
import { db } from '../index';
import { mdmProfiles, mdmDevices, mdmCommands, organizations } from '@config-management/database';
import { eq, and, desc } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth';
import Joi from 'joi';
import * as crypto from 'crypto';

const router = Router();
const publicRouter = Router();

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
  enrollmentKey: Joi.string().optional(),
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
      .select()
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

// Device Management
router.get('/devices', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const devices = await db
      .select()
      .from(mdmDevices)
      .where(eq(mdmDevices.organizationId, req.user!.organizationId))
      .orderBy(desc(mdmDevices.lastSeen));

    res.json(devices);
  } catch (error) {
    console.error('Error fetching MDM devices:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a device
router.delete('/devices/:deviceId', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    // First find the device to ensure it belongs to the user's organization
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

    // Delete all commands associated with this device first
    await db
      .delete(mdmCommands)
      .where(eq(mdmCommands.deviceId, device[0].id));

    // Delete the device
    await db
      .delete(mdmDevices)
      .where(eq(mdmDevices.id, device[0].id));

    res.json({ message: 'Device deleted successfully', deviceId: req.params.deviceId });
  } catch (error) {
    console.error('Error deleting MDM device:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Device enrollment endpoint - PUBLIC ENDPOINT
publicRouter.post('/enroll', async (req, res): Promise<any> => {
  try {
    const { error, value } = deviceEnrollmentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    let organizationId: string;
    let profileId: string | null = null;

    if (value.enrollmentKey) {
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
      organizationId = 'eb602306-9701-4b99-845d-371833d9fcd6'; // Default org
    }

    const existingDevice = await db
      .select()
      .from(mdmDevices)
      .where(eq(mdmDevices.deviceId, value.deviceId))
      .limit(1);

    if (existingDevice[0]) {
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
        organizationId: organizationId,
      };
      
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

// Get commands for a device (for UI display)
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
      .orderBy(desc(mdmCommands.createdAt))
      .limit(50);

    res.json(commands);
  } catch (error) {
    console.error('Error fetching device commands:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new command for a device
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

// Agent installer endpoint
// Agent installer endpoint (both paths for compatibility)
const agentInstallerHandler = async (req: any, res: any): Promise<any> => {
  try {
    // The installer script should accept the enrollment key as a command line argument
    // It will be passed via: bash -s <enrollment_key> or ./pulse-install.sh <enrollment_key>
    const serverUrl = req.query.server as string || `${req.protocol}://${req.get('host')}/api`;
    
    const installer = `#!/bin/bash
set -e

# Get enrollment key from command line argument
ENROLLMENT_KEY="\${1}"
SERVER_URL="${serverUrl}"

echo "🚀 Installing Pulse MDM Agent"

# Validate enrollment key
if [ -z "\$ENROLLMENT_KEY" ]; then
  echo "❌ Error: Enrollment key required"
  echo "Usage: \$0 <enrollment-key>"
  echo "Example: \$0 715d6045fb653e6a85a83a06a3a3c36d5f881c6a1ed3fe46bdd0c82b32c8d633"
  exit 1
fi

echo "📱 Enrollment Key: \$ENROLLMENT_KEY"
echo "🌐 Server URL: \$SERVER_URL"

# Create agent directory
AGENT_DIR="\$HOME/.pulse-mdm"
mkdir -p "\$AGENT_DIR"

# Save enrollment configuration
echo "\$ENROLLMENT_KEY" > "\$AGENT_DIR/enrollment_key"
echo "\$SERVER_URL" > "\$AGENT_DIR/server_url"

echo "🔐 Enrolling device with key: \$ENROLLMENT_KEY"

# Get device info
DEVICE_NAME=\$(hostname)
DEVICE_ID=\$(uname -n)
SERIAL_NUMBER=\$(system_profiler SPHardwareDataType 2>/dev/null | grep "Serial Number" | awk '{print \$4}' || echo "unknown")
MODEL=\$(system_profiler SPHardwareDataType 2>/dev/null | grep "Model Name" | cut -d: -f2 | xargs || echo "unknown")
OS_VERSION=\$(sw_vers -productVersion 2>/dev/null || uname -r)
ARCHITECTURE=\$(uname -m)

# Enroll device
curl -X POST "\$SERVER_URL/mdm/enroll" \\
  -H "Content-Type: application/json" \\
  -d "{
    \\"enrollmentKey\\": \\"\$ENROLLMENT_KEY\\",
    \\"deviceName\\": \\"\$DEVICE_NAME\\",
    \\"deviceId\\": \\"\$DEVICE_ID\\",
    \\"serialNumber\\": \\"\$SERIAL_NUMBER\\",
    \\"model\\": \\"\$MODEL\\",
    \\"osVersion\\": \\"\$OS_VERSION\\",
    \\"architecture\\": \\"\$ARCHITECTURE\\"
  }" && echo "✅ Device enrolled successfully!" || echo "❌ Enrollment failed"

echo "✅ Pulse MDM Agent installed"
echo "📁 Agent configuration stored in: \$AGENT_DIR"
`;
    
    res.setHeader('Content-Type', 'application/x-shellscript');
    res.setHeader('Content-Disposition', 'attachment; filename="pulse-mdm-agent-install.sh"');
    res.send(installer);
  } catch (error) {
    console.error('Error generating installer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

publicRouter.get('/agent/installer', agentInstallerHandler);
publicRouter.get('/download/agent-installer', agentInstallerHandler);

export { router as mdmRoutes, publicRouter as mdmPublicRoutes };
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

// Download Agent Installer Script - PUBLIC ENDPOINT (must be before :token route)
publicRouter.get('/download/agent-installer', async (req, res): Promise<any> => {
  try {
    const agentInstallerPath = path.join(process.cwd(), '../../mdm-agent/install-with-key.sh');
    
    if (fs.existsSync(agentInstallerPath)) {
      const installerScript = fs.readFileSync(agentInstallerPath, 'utf8');
      
      res.setHeader('Content-Type', 'application/x-shellscript');
      res.setHeader('Content-Disposition', 'attachment; filename="pulse-mdm-agent-install.sh"');
      res.send(installerScript);
    } else {
      return res.status(404).json({ error: 'Pulse MDM agent installer not found' });
    }

  } catch (error) {
    console.error('Error downloading Pulse agent installer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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
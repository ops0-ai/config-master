import { Router } from 'express';
import { db } from '../index';
import { organizationSettings } from '@config-management/database';
import { eq } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth';
import Joi from 'joi';
import crypto from 'crypto';

const router = Router();

// Encryption functions
const algorithm = 'aes-256-gcm';
// Use a consistent key - in production, this should be set as an environment variable
const rawKey = process.env.ENCRYPTION_KEY || 'cm-default-key-32-chars-exactly!';

// Ensure key is exactly 32 bytes for AES-256
const secretKey = rawKey.padEnd(32, '0').substring(0, 32);

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(secretKey), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedData: string): string {
  const parts = encryptedData.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const decipher = crypto.createDecipheriv(algorithm, Buffer.from(secretKey), iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

const settingsSchema = Joi.object({
  claudeApiKey: Joi.string().optional().allow(''),
  defaultRegion: Joi.string().optional(),
  maxConcurrentDeployments: Joi.number().min(1).max(20).optional(),
  deploymentTimeout: Joi.number().min(60).max(3600).optional(),
});

// Get settings for the organization
router.get('/', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const orgId = req.user!.organizationId;
    
    // Fetch from database
    const dbSettings = await db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, orgId))
      .limit(1);

    const settings = dbSettings[0] || {
      claudeApiKey: '',
      defaultRegion: 'us-east-1',
      maxConcurrentDeployments: 5,
      deploymentTimeout: 300,
    };

    // Mask the API key for security
    if (settings.claudeApiKey) {
      const decrypted = decrypt(settings.claudeApiKey);
      
      // Ensure the environment variable is set
      process.env.CLAUDE_API_KEY = decrypted;
      
      const response = {
        ...settings,
        claudeApiKey: decrypted.substring(0, 10) + '...' + decrypted.substring(decrypted.length - 4),
        claudeApiKeyConfigured: true,
      };
      
      res.json(response);
    } else {
      res.json(settings);
    }
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update settings for the organization
router.put('/', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { error, value } = settingsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const orgId = req.user!.organizationId;
    
    // Fetch current settings from database
    const currentDbSettings = await db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, orgId))
      .limit(1);

    const currentSettings = currentDbSettings[0] || {};

    // Prepare update values
    const updateValues: any = {
      organizationId: orgId,
      defaultRegion: value.defaultRegion || currentSettings.defaultRegion || 'us-east-1',
      maxConcurrentDeployments: value.maxConcurrentDeployments || currentSettings.maxConcurrentDeployments || 5,
      deploymentTimeout: value.deploymentTimeout || currentSettings.deploymentTimeout || 300,
      updatedAt: new Date(),
    };

    // Only update Claude API key if a new one is provided (not masked)
    if (value.claudeApiKey && !value.claudeApiKey.includes('...')) {
      const encryptedKey = encrypt(value.claudeApiKey);
      updateValues.claudeApiKey = encryptedKey;
      
      // Update the global environment variable so the conversation route can use it
      process.env.CLAUDE_API_KEY = value.claudeApiKey;
    } else if (currentSettings.claudeApiKey) {
      // Keep the existing key if not updating
      updateValues.claudeApiKey = currentSettings.claudeApiKey;
      
      // Ensure env var is set with existing key
      const decryptedKey = decrypt(currentSettings.claudeApiKey);
      process.env.CLAUDE_API_KEY = decryptedKey;
    }

    // Insert or update
    let result;
    if (currentSettings.id) {
      // Update existing
      result = await db
        .update(organizationSettings)
        .set(updateValues)
        .where(eq(organizationSettings.organizationId, orgId))
        .returning();
    } else {
      // Insert new
      result = await db
        .insert(organizationSettings)
        .values(updateValues)
        .returning();
    }

    const savedSettings = result[0];

    // Return masked version
    const responseSettings: any = { ...savedSettings };
    if (responseSettings.claudeApiKey) {
      const decrypted = decrypt(responseSettings.claudeApiKey);
      responseSettings.claudeApiKey = decrypted.substring(0, 10) + '...' + decrypted.substring(decrypted.length - 4);
      responseSettings.claudeApiKeyConfigured = true;
    }

    res.json({ 
      message: 'Settings updated successfully', 
      settings: responseSettings 
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test Claude API connection
router.post('/test-claude', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const orgId = req.user!.organizationId;
    
    // Fetch from database
    const dbSettings = await db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, orgId))
      .limit(1);
    
    const settings = dbSettings[0];
    
    if (!settings?.claudeApiKey) {
      return res.status(400).json({ error: 'Claude API key not configured' });
    }

    const apiKey = decrypt(settings.claudeApiKey);
    
    // Test the API key with a simple request
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey });
    
    // Retry configuration for API test
    const maxRetries = 2;
    const baseDelay = 1000;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        });
        
        return res.json({ 
          success: true, 
          message: 'Claude API connection successful' 
        });
      } catch (apiError: any) {
        console.error(`Claude API test attempt ${attempt} failed:`, apiError);
        
        const isOverloadedError = apiError.message?.includes('529') || 
                                 apiError.message?.includes('overloaded') ||
                                 apiError.message?.includes('Overloaded') ||
                                 apiError.status === 529;
        
        if (attempt === maxRetries || !isOverloadedError) {
          if (isOverloadedError) {
            return res.status(503).json({ 
              error: 'Claude API is currently overloaded', 
              details: 'Please try again in a few minutes. The AI service is experiencing high demand.' 
            });
          }
          return res.status(400).json({ 
            error: 'Claude API connection failed', 
            details: apiError.message 
          });
        }
        
        // Wait before retrying
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  } catch (error) {
    console.error('Error testing Claude connection:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Initialize settings on startup - load API keys into environment
export async function initializeSettings(organizationId?: string) {
  try {
    // If no org ID provided, try to load the first organization's settings
    let query = db.select().from(organizationSettings);
    
    if (organizationId) {
      query = query.where(eq(organizationSettings.organizationId, organizationId)) as any;
    }
    
    const settings = await query.limit(1);
    
    if (settings[0]?.claudeApiKey) {
      const decrypted = decrypt(settings[0].claudeApiKey);
      process.env.CLAUDE_API_KEY = decrypted;
      console.log('✅ Claude API key loaded from database');
    }
  } catch (error) {
    console.error('Failed to initialize settings:', error);
  }
}

export { router as settingsRoutes };
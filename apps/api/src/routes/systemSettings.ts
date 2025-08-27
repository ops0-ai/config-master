import { Router, Response } from 'express';
import { db } from '../index';
import { systemSettings, users } from '@config-management/database';
import { eq } from 'drizzle-orm';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// Middleware to check super admin access
const requireSuperAdmin = async (req: AuthenticatedRequest, res: any, next: any): Promise<any> => {
  try {
    if (!req.user?.isSuperAdmin) {
      return res.status(403).json({ 
        error: 'Super admin access required',
        message: 'You must be a super admin to manage system settings'
      });
    }
    next();
  } catch (error) {
    console.error('Error checking super admin status:', error);
    return res.status(500).json({ error: 'Failed to verify admin privileges' });
  }
};

// Validation schema for updating settings
const updateSettingSchema = z.object({
  value: z.any(),
  description: z.string().optional(),
});

// Get all system settings (super admin only)
router.get('/', authMiddleware, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const settings = await db
      .select()
      .from(systemSettings)
      .orderBy(systemSettings.category, systemSettings.key);

    res.json(settings);
  } catch (error) {
    console.error('Error fetching system settings:', error);
    res.status(500).json({ error: 'Failed to fetch system settings' });
  }
});

// Get a specific system setting (super admin only)
router.get('/:key', authMiddleware, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { key } = req.params;
    
    const setting = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, key))
      .limit(1);

    if (!setting[0]) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    res.json(setting[0]);
  } catch (error) {
    console.error('Error fetching system setting:', error);
    res.status(500).json({ error: 'Failed to fetch system setting' });
  }
});

// Update a system setting (super admin only)
router.put('/:key', authMiddleware, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { key } = req.params;
    const validation = updateSettingSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.issues[0].message });
    }

    const { value, description } = validation.data;

    // Check if setting exists
    const existingSetting = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, key))
      .limit(1);

    if (!existingSetting[0]) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    // Check if setting is readonly
    if (existingSetting[0].isReadonly) {
      return res.status(403).json({ 
        error: 'Setting is read-only',
        message: 'This system setting cannot be modified through the API'
      });
    }

    // Update the setting
    const [updatedSetting] = await db
      .update(systemSettings)
      .set({
        value: value,
        description: description || existingSetting[0].description,
        updatedBy: req.user!.id,
        updatedAt: new Date(),
      })
      .where(eq(systemSettings.key, key))
      .returning();

    console.log(`✅ System setting '${key}' updated by ${req.user!.email}`);
    res.json(updatedSetting);
  } catch (error) {
    console.error('Error updating system setting:', error);
    res.status(500).json({ error: 'Failed to update system setting' });
  }
});

// Get public system settings (no auth required)
router.get('/public/info', async (req, res): Promise<any> => {
  try {
    const publicSettings = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.category, 'public'));

    // Convert to key-value pairs for easier consumption
    const settingsMap = publicSettings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, any>);

    res.json(settingsMap);
  } catch (error) {
    console.error('Error fetching public system settings:', error);
    res.status(500).json({ error: 'Failed to fetch public settings' });
  }
});

// Test webhook endpoint
router.post('/test-webhook', authMiddleware, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { webhookUrl } = req.body;
    
    if (!webhookUrl) {
      return res.status(400).json({ error: 'Webhook URL is required' });
    }

    // Import webhook service
    const { userSignupWebhookService } = await import('../services/userSignupWebhook');
    
    // Create test webhook data
    const testWebhookData = {
      userId: 'test-user-id',
      userName: 'Test User',
      userEmail: 'test@acmecorp.com',
      organizationId: 'test-org-id',
      organizationName: 'Test Organization',
      company: 'Acmecorp',
      domain: 'acmecorp.com',
      isFirstTimeSignup: true,
      signupDate: new Date().toISOString()
    };

    // Send test webhook
    await userSignupWebhookService.sendUserSignupWebhook(webhookUrl, testWebhookData);
    
    res.json({ success: true, message: 'Test webhook sent successfully' });
  } catch (error: any) {
    console.error('Test webhook error:', error);
    res.status(500).json({ 
      error: 'Failed to send test webhook',
      details: error.message 
    });
  }
});

export default router;
import axios from 'axios';

export interface UserSignupWebhookData {
  userId: string;
  userName: string;
  userEmail: string;
  organizationId: string;
  organizationName: string;
  company: string | null;
  domain: string | null;
  isFirstTimeSignup: boolean;
  signupDate: string;
}

export class UserSignupWebhookService {
  /**
   * Extract company name from email domain
   */
  private extractCompanyFromEmail(email: string): { company: string | null; domain: string | null } {
    if (!email || !email.includes('@')) {
      return { company: null, domain: null };
    }
    
    const domain = email.split('@')[1].toLowerCase();
    
    // Common email providers that we should not extract company names from
    const commonProviders = [
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
      'aol.com', 'protonmail.com', 'mail.com', 'ymail.com', 'live.com',
      'msn.com', 'rediffmail.com', 'zoho.com'
    ];
    
    if (commonProviders.includes(domain)) {
      return { company: null, domain };
    }
    
    // Extract company name (remove TLD and capitalize)
    const company = domain
      .split('.')[0] // Take the part before the first dot
      .split(/[-_]/) // Split on hyphens and underscores
      .map(part => part.charAt(0).toUpperCase() + part.slice(1)) // Capitalize each part
      .join(' '); // Join with spaces
    
    return { company, domain };
  }

  /**
   * Send a webhook notification for new user signup
   */
  async sendUserSignupWebhook(webhookUrl: string, userData: UserSignupWebhookData): Promise<void> {
    try {
      console.log(`📤 Sending user signup webhook to ${webhookUrl}`);
      
      const message = this.generateSignupMessage(userData);
      
      // Teams webhook format
      const webhookPayload = {
        text: message
      };

      const response = await axios.post(webhookUrl, webhookPayload, {
        timeout: 10000, // 10 second timeout
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Pulse-Webhook/1.0'
        }
      });

      console.log(`✅ User signup webhook sent successfully: ${response.status}`);
    } catch (error: any) {
      console.error('❌ Failed to send user signup webhook:', error.response?.data || error.message);
      // Don't throw error - webhook failures shouldn't break user registration
    }
  }

  /**
   * Generate a formatted message for the signup
   */
  private generateSignupMessage(userData: UserSignupWebhookData): string {
    let message = `🎉 **New User Signup**\n\n`;
    message += `**User:** ${userData.userName}\n\n`;
    message += `**Email:** ${userData.userEmail}\n\n`;
    
    if (userData.company) {
      message += `**Company:** ${userData.company}\n\n`;
    }
    
    message += `**Organization:** ${userData.organizationName}\n\n`;
    message += `**Action:** signed up for the first time\n\n`;
    
    if (userData.company) {
      message += `A user from ${userData.company} has just signed up to Pulse!`;
    } else {
      message += `A user has just signed up to Pulse!`;
    }
    
    return message;
  }

  /**
   * Get system webhook settings and send notification if enabled
   */
  async notifyUserSignup(userData: UserSignupWebhookData): Promise<void> {
    console.log(`🔔 UserSignupWebhookService: Starting notification for ${userData.userEmail}`);
    try {
      // Import here to avoid circular dependencies
      const { db } = await import('../index');
      const { systemSettings } = await import('@config-management/database');
      const { eq } = await import('drizzle-orm');

      // Check if webhook notifications are enabled and get URL
      const webhookUrlSetting = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, 'user_signup_webhook_url'))
        .limit(1);

      const notificationsSetting = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, 'webhook_new_org_notifications'))
        .limit(1);

      // Parse JSONB values properly - they come as actual values, not JSON strings
      const webhookUrl = webhookUrlSetting[0]?.value;
      const notificationsEnabled = notificationsSetting[0]?.value === true;

      console.log(`🔔 UserSignupWebhookService: webhookUrl=${webhookUrl}, notificationsEnabled=${notificationsEnabled}`);

      if (webhookUrl && notificationsEnabled) {
        console.log(`🔔 UserSignupWebhookService: Sending webhook to ${webhookUrl}`);
        await this.sendUserSignupWebhook(webhookUrl, userData);
        console.log(`✅ UserSignupWebhookService: Webhook sent successfully`);
      } else {
        console.log(`⚠️ UserSignupWebhookService: Webhook not sent - URL missing or notifications disabled`);
      }
    } catch (error) {
      console.error('Error checking webhook settings:', error);
    }
  }
}

// Export singleton instance
export const userSignupWebhookService = new UserSignupWebhookService();
import { db } from '../index';
import { deployments } from '@config-management/database';
import { eq, and, lte, sql } from 'drizzle-orm';
import * as cronParser from 'cron-parser';

// Service to handle scheduled and recurring deployments
export class DeploymentScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 60 * 1000; // Check every minute

  start() {
    console.log('🕐 Starting deployment scheduler...');
    
    // Run immediately once
    this.checkScheduledDeployments();
    
    // Then run every minute
    this.intervalId = setInterval(() => {
      this.checkScheduledDeployments();
    }, this.CHECK_INTERVAL);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('⏹️ Deployment scheduler stopped');
    }
  }

  private async checkScheduledDeployments() {
    try {
      const now = new Date();
      
      // Find deployments that are due to run
      const dueDeployments = await db
        .select()
        .from(deployments)
        .where(
          sql`${deployments.status} IN ('scheduled', 'pending')`
        );

      for (const deployment of dueDeployments) {
        await this.executeScheduledDeployment(deployment);
      }
    } catch (error) {
      console.error('Error checking scheduled deployments:', error);
    }
  }

  private async executeScheduledDeployment(deployment: any) {
    try {
      console.log(`⚡ Executing scheduled deployment: ${deployment.name} (${deployment.id})`);
      
      // Update deployment status to running
      await db
        .update(deployments)
        .set({
          status: 'running',
          startedAt: new Date(),
        })
        .where(eq(deployments.id, deployment.id));

      // TODO: Trigger actual deployment execution here
      // This would call the same logic as the manual run deployment
      await this.triggerDeploymentExecution(deployment);

      // Handle recurring deployments - calculate next run time
      if (deployment.scheduleType === 'recurring' && deployment.cronExpression) {
        const nextRunAt = this.calculateNextRunTime(deployment.cronExpression, deployment.timezone);
        
        await db
          .update(deployments)
          .set({
            lastRunAt: new Date(),
            nextRunAt,
          })
          .where(eq(deployments.id, deployment.id));
          
        console.log(`🔄 Recurring deployment scheduled for next run: ${nextRunAt}`);
      } else if (deployment.scheduleType === 'scheduled') {
        // One-time scheduled deployment - mark as completed scheduling
        await db
          .update(deployments)
          .set({
            lastRunAt: new Date(),
            nextRunAt: null,
          })
          .where(eq(deployments.id, deployment.id));
      }

    } catch (error) {
      console.error(`Error executing scheduled deployment ${deployment.id}:`, error);
      
      // Mark deployment as failed
      await db
        .update(deployments)
        .set({
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        })
        .where(eq(deployments.id, deployment.id));
    }
  }

  private async triggerDeploymentExecution(deployment: any) {
    // This is a placeholder for the actual deployment execution logic
    // In a real implementation, this would integrate with your existing deployment execution system
    
    console.log(`🚀 Triggering deployment execution for: ${deployment.name}`);
    
    // Simulate deployment execution
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`✅ Deployment ${deployment.name} completed`);
        resolve(undefined);
      }, 5000); // Simulate 5 second deployment
    });
  }

  private calculateNextRunTime(cronExpression: string, timezone: string = 'UTC'): Date {
    try {
      const interval = cronParser.parseExpression(cronExpression, { tz: timezone });
      return interval.next().toDate();
    } catch (error) {
      console.error('Error calculating next run time:', error);
      // Fallback: try again in 1 hour
      return new Date(Date.now() + 60 * 60 * 1000);
    }
  }

  // Method to manually pause/resume a recurring deployment
  async pauseRecurringDeployment(deploymentId: string) {
    await db
      .update(deployments)
      .set({ isActive: false })
      .where(eq(deployments.id, deploymentId));
  }

  async resumeRecurringDeployment(deploymentId: string) {
    const deployment = await db
      .select()
      .from(deployments)
      .where(eq(deployments.id, deploymentId))
      .limit(1);

    if (deployment[0] && deployment[0].cronExpression) {
      const nextRunAt = this.calculateNextRunTime(
        deployment[0].cronExpression, 
        deployment[0].timezone || 'UTC'
      );

      await db
        .update(deployments)
        .set({ 
          isActive: true,
          nextRunAt 
        })
        .where(eq(deployments.id, deploymentId));
    }
  }
}

// Export singleton instance
export const deploymentScheduler = new DeploymentScheduler();
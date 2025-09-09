import { drizzle } from 'drizzle-orm/postgres-js';
import { hiveAgents } from '@config-management/database';
import { eq, lt, and } from 'drizzle-orm';

export class HiveMonitorService {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly db: any;
  private readonly checkInterval: number = 60000; // Check every minute
  private readonly offlineThreshold: number = 120000; // Mark offline after 2 minutes of no heartbeat

  constructor(db: any) {
    this.db = db;
  }

  start(): void {
    if (this.intervalId) {
      return; // Already running
    }

    console.log('Starting Hive Monitor Service...');
    this.intervalId = setInterval(() => {
      this.checkAgentStatus();
    }, this.checkInterval);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Hive Monitor Service stopped');
    }
  }

  private async checkAgentStatus(): Promise<void> {
    try {
      const thresholdTime = new Date(Date.now() - this.offlineThreshold);
      
      // Find all agents that are currently marked as online but haven't sent heartbeat recently
      const staleAgents = await this.db.select()
        .from(hiveAgents)
        .where(and(
          eq(hiveAgents.status, 'online'),
          lt(hiveAgents.lastHeartbeat, thresholdTime)
        ));

      if (staleAgents.length > 0) {
        console.log(`Marking ${staleAgents.length} agents as offline due to missing heartbeats`);
        
        // Update all stale agents to offline status
        await this.db.update(hiveAgents)
          .set({
            status: 'offline',
            updatedAt: new Date()
          })
          .where(and(
            eq(hiveAgents.status, 'online'),
            lt(hiveAgents.lastHeartbeat, thresholdTime)
          ));
      }
    } catch (error) {
      console.error('Error checking agent status:', error);
    }
  }
}

// Global instance
let hiveMonitorInstance: HiveMonitorService | null = null;

export function startHiveMonitor(db: any): HiveMonitorService {
  if (!hiveMonitorInstance) {
    hiveMonitorInstance = new HiveMonitorService(db);
    hiveMonitorInstance.start();
  }
  return hiveMonitorInstance;
}

export function stopHiveMonitor(): void {
  if (hiveMonitorInstance) {
    hiveMonitorInstance.stop();
    hiveMonitorInstance = null;
  }
}
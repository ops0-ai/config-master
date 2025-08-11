import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { 
  servers, 
  configurations, 
  configurationStates, 
  deployments, 
  conversations,
  messages,
  auditLogs 
} from '@config-management/database';
import { eq, and } from 'drizzle-orm';
import { config } from 'dotenv';

config();

const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const client = postgres(connectionString);
const db = drizzle(client);

async function seedSampleData() {
  try {
    console.log('🌱 Seeding sample data for dashboard...');

    // Get the demo organization and user
    const { organizations, users } = await import('@config-management/database');
    
    const org = await db.select().from(organizations).limit(1);
    const user = await db.select().from(users).limit(1);
    
    if (!org[0] || !user[0]) {
      console.log('❌ No organization or user found. Please run seed script first.');
      return;
    }

    const organizationId = org[0].id;
    const userId = user[0].id;

    // Create sample servers if they don't exist
    const existingServers = await db.select().from(servers).where(eq(servers.organizationId, organizationId));
    
    if (existingServers.length === 0) {
      console.log('Creating sample servers...');
      
      const sampleServers = [
        { name: 'web-server-01', hostname: 'web01.example.com', ipAddress: '192.168.1.10', status: 'online' },
        { name: 'web-server-02', hostname: 'web02.example.com', ipAddress: '192.168.1.11', status: 'online' },
        { name: 'api-server-01', hostname: 'api01.example.com', ipAddress: '192.168.1.20', status: 'online' },
        { name: 'db-server-01', hostname: 'db01.example.com', ipAddress: '192.168.1.30', status: 'offline' },
        { name: 'cache-server-01', hostname: 'cache01.example.com', ipAddress: '192.168.1.40', status: 'online' },
      ];

      for (const serverData of sampleServers) {
        await db.insert(servers).values({
          ...serverData,
          organizationId,
          port: 22,
          username: 'ubuntu',
        });
      }
      
      console.log(`✓ Created ${sampleServers.length} sample servers`);
    }

    // Create sample configurations if they don't exist
    const existingConfigs = await db.select().from(configurations).where(eq(configurations.organizationId, organizationId));
    
    if (existingConfigs.length === 0) {
      console.log('Creating sample configurations...');
      
      const sampleConfigurations = [
        {
          name: 'NGINX Web Server Setup',
          description: 'Standard NGINX configuration for web servers',
          type: 'playbook',
          ansiblePlaybook: `---
- name: Setup NGINX
  hosts: all
  become: yes
  tasks:
    - name: Install NGINX
      package:
        name: nginx
        state: present
    - name: Start NGINX
      service:
        name: nginx
        state: started
        enabled: yes`,
          source: 'template',
          approvalStatus: 'approved',
        },
        {
          name: 'Docker Installation',
          description: 'Docker CE installation and setup',
          type: 'playbook',
          ansiblePlaybook: `---
- name: Install Docker
  hosts: all
  become: yes
  tasks:
    - name: Install Docker CE
      package:
        name: docker-ce
        state: present
    - name: Start Docker
      service:
        name: docker
        state: started
        enabled: yes`,
          source: 'template',
          approvalStatus: 'approved',
        },
        {
          name: 'Security Hardening',
          description: 'Basic security hardening configuration',
          type: 'playbook',
          ansiblePlaybook: `---
- name: Security hardening
  hosts: all
  become: yes
  tasks:
    - name: Update packages
      package:
        name: "*"
        state: latest
    - name: Configure firewall
      ufw:
        state: enabled`,
          source: 'manual',
          approvalStatus: 'pending',
        },
      ];

      for (const configData of sampleConfigurations) {
        await db.insert(configurations).values({
          ...configData,
          organizationId,
          createdBy: userId,
        });
      }
      
      console.log(`✓ Created ${sampleConfigurations.length} sample configurations`);
    }

    // Get current servers and configurations
    const allServers = await db.select().from(servers).where(eq(servers.organizationId, organizationId));
    const allConfigs = await db.select().from(configurations).where(eq(configurations.organizationId, organizationId));

    // Create sample configuration states (for drift detection)
    const existingStates = await db.select().from(configurationStates).where(eq(configurationStates.organizationId, organizationId));
    
    if (existingStates.length === 0 && allServers.length > 0 && allConfigs.length > 0) {
      console.log('Creating sample configuration states...');
      
      const sampleStates = [
        {
          serverId: allServers[0].id,
          configurationId: allConfigs[0].id,
          expectedState: {
            packages: { nginx: { installed: true, version: '1.18.0' }},
            services: { nginx: { state: 'running', enabled: true }},
            ports: [80, 443]
          },
          actualState: {
            packages: { nginx: { installed: true, version: '1.18.0' }},
            services: { nginx: { state: 'running', enabled: true }},
            ports: [80, 443]
          },
          status: 'compliant',
          driftDetected: false,
          lastChecked: new Date(),
        },
        {
          serverId: allServers[1].id,
          configurationId: allConfigs[0].id,
          expectedState: {
            packages: { nginx: { installed: true, version: '1.18.0' }},
            services: { nginx: { state: 'running', enabled: true }},
            ports: [80, 443]
          },
          actualState: {
            packages: { nginx: { installed: true, version: '1.16.0' }},
            services: { nginx: { state: 'stopped', enabled: false }},
            ports: []
          },
          status: 'drift_detected',
          driftDetected: true,
          driftDetails: {
            packages: { nginx: { status: 'version_mismatch', expected: '1.18.0', actual: '1.16.0' }},
            services: { nginx: { status: 'state_mismatch', expected: 'running', actual: 'stopped' }}
          },
          lastChecked: new Date(),
        },
        {
          serverId: allServers[2].id,
          configurationId: allConfigs[1].id,
          expectedState: {
            packages: { 'docker-ce': { installed: true, version: '20.10.8' }},
            services: { docker: { state: 'running', enabled: true }}
          },
          actualState: {
            packages: { 'docker-ce': { installed: true, version: '20.10.8' }},
            services: { docker: { state: 'running', enabled: true }}
          },
          status: 'compliant',
          driftDetected: false,
          lastChecked: new Date(),
        },
      ];

      for (const stateData of sampleStates) {
        await db.insert(configurationStates).values({
          ...stateData,
          organizationId,
        });
      }
      
      console.log(`✓ Created ${sampleStates.length} sample configuration states`);
    }

    // Create sample deployments
    const existingDeployments = await db.select().from(deployments).where(eq(deployments.organizationId, organizationId));
    
    if (existingDeployments.length === 0 && allServers.length > 0 && allConfigs.length > 0) {
      console.log('Creating sample deployments...');
      
      const sampleDeployments = [
        {
          name: 'NGINX Setup - web-server-01',
          configurationId: allConfigs[0].id,
          targetType: 'server' as const,
          targetId: allServers[0].id,
          status: 'completed' as const,
          startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 5 * 60 * 1000), // 1h55m ago
          logs: 'Deployment completed successfully\\nNGINX installed and configured',
          executedBy: userId,
        },
        {
          name: 'Docker Installation - api-server-01',
          configurationId: allConfigs[1].id,
          targetType: 'server' as const,
          targetId: allServers[2].id,
          status: 'completed' as const,
          startedAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
          completedAt: new Date(Date.now() - 6 * 60 * 60 * 1000 + 8 * 60 * 1000), // 5h52m ago
          logs: 'Docker CE installed successfully\\nDocker service started and enabled',
          executedBy: userId,
        },
        {
          name: 'Security Hardening - Failed',
          configurationId: allConfigs[2].id,
          targetType: 'server' as const,
          targetId: allServers[3].id,
          status: 'failed' as const,
          startedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
          completedAt: new Date(Date.now() - 1 * 60 * 60 * 1000 + 2 * 60 * 1000), // 58m ago
          logs: 'Deployment failed\\nServer unreachable',
          executedBy: userId,
        },
      ];

      for (const deploymentData of sampleDeployments) {
        await db.insert(deployments).values({
          ...deploymentData,
          organizationId,
        });
      }
      
      console.log(`✓ Created ${sampleDeployments.length} sample deployments`);
    }

    // Create sample conversations and messages
    const existingConversations = await db.select().from(conversations).where(eq(conversations.organizationId, organizationId));
    
    if (existingConversations.length === 0) {
      console.log('Creating sample conversations...');
      
      const conversation1 = await db.insert(conversations).values({
        title: 'NGINX Configuration Setup',
        userId,
        organizationId,
        isActive: true,
      }).returning();

      const conversation2 = await db.insert(conversations).values({
        title: 'Docker Installation Help',
        userId,
        organizationId,
        isActive: false,
      }).returning();

      // Add messages to conversations
      await db.insert(messages).values([
        {
          conversationId: conversation1[0].id,
          role: 'user',
          content: 'How do I set up NGINX on Ubuntu?',
        },
        {
          conversationId: conversation1[0].id,
          role: 'assistant',
          content: 'I can help you set up NGINX on Ubuntu. Here is a comprehensive Ansible playbook...',
          generatedConfiguration: `---
- name: Setup NGINX on Ubuntu
  hosts: all
  become: yes
  tasks:
    - name: Update apt cache
      apt: update_cache=yes
    - name: Install NGINX
      apt: name=nginx state=present
    - name: Start NGINX service
      service: name=nginx state=started enabled=yes`,
        },
        {
          conversationId: conversation2[0].id,
          role: 'user',
          content: 'Install Docker on my servers',
        },
        {
          conversationId: conversation2[0].id,
          role: 'assistant',
          content: 'I will create a Docker installation playbook for you...',
          generatedConfiguration: `---
- name: Install Docker CE
  hosts: all
  become: yes
  tasks:
    - name: Install Docker
      package: name=docker-ce state=present`,
        },
      ]);
      
      console.log(`✓ Created sample conversations and messages`);
    }

    // Create sample audit logs
    const existingAuditLogs = await db.select().from(auditLogs).where(eq(auditLogs.organizationId, organizationId));
    
    if (existingAuditLogs.length === 0) {
      console.log('Creating sample audit logs...');
      
      const sampleAuditLogs = [
        {
          userId,
          organizationId,
          action: 'create',
          resource: 'servers',
          resourceId: allServers[0]?.id,
          details: { name: 'web-server-01' },
          ipAddress: '127.0.0.1',
          createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
        },
        {
          userId,
          organizationId,
          action: 'update',
          resource: 'deployments',
          resourceId: 'deployment-1',
          details: { status: 'completed' },
          ipAddress: '127.0.0.1',
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        },
        {
          userId,
          organizationId,
          action: 'create',
          resource: 'configurations',
          resourceId: allConfigs[0]?.id,
          details: { name: 'NGINX Web Server Setup' },
          ipAddress: '127.0.0.1',
          createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        },
        {
          userId,
          organizationId,
          action: 'create',
          resource: 'conversations',
          resourceId: 'conversation-1',
          details: { title: 'NGINX Configuration Setup' },
          ipAddress: '127.0.0.1',
          createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        },
      ];

      for (const logData of sampleAuditLogs) {
        await db.insert(auditLogs).values(logData);
      }
      
      console.log(`✓ Created ${sampleAuditLogs.length} sample audit logs`);
    }

    console.log('\\n🎉 Sample data seeding completed successfully!');
    console.log('\\n📊 Dashboard should now show real data including:');
    console.log('   • Server statistics and status');
    console.log('   • Configuration states and drift detection');
    console.log('   • Deployment history and success rates');
    console.log('   • Conversation and message counts');
    console.log('   • Recent activity from audit logs');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Sample data seeding failed:', error);
    process.exit(1);
  }
}

seedSampleData();
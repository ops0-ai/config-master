import { db } from '../index';
import { permissions, organizations } from '@config-management/database';
import { sql } from 'drizzle-orm';

export class MigrationService {
  async runInitialMigrations(): Promise<void> {
    console.log('🔧 Running database migrations...');
    
    try {
      // 1. Ensure all required columns exist
      await this.ensureRequiredColumns();
      
      // 2. Seed system permissions
      await this.seedSystemPermissions();
      
      // 3. Update organization feature flags
      await this.updateOrganizationFeatures();
      
      console.log('✅ All migrations completed successfully');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  private async ensureRequiredColumns(): Promise<void> {
    console.log('  📋 Ensuring required database columns...');
    
    const migrations = [
      {
        name: 'configurations.metadata',
        sql: `ALTER TABLE configurations ADD COLUMN IF NOT EXISTS metadata jsonb;`
      },
      {
        name: 'organizations.features_enabled',
        sql: `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS features_enabled jsonb DEFAULT '{"servers": true, "serverGroups": true, "pemKeys": true, "configurations": true, "deployments": true, "chat": true, "training": true, "awsIntegrations": true, "githubIntegrations": true, "mdm": true, "assets": true, "auditLogs": true}'::jsonb;`
      },
      {
        name: 'assets.mdm_device_id',
        sql: `ALTER TABLE assets ADD COLUMN IF NOT EXISTS mdm_device_id varchar;`
      },
      {
        name: 'users.is_super_admin',
        sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin boolean DEFAULT false;`
      },
      {
        name: 'users.has_completed_onboarding',
        sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS has_completed_onboarding boolean DEFAULT false;`
      },
      {
        name: 'users.is_sso',
        sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_sso boolean DEFAULT false;`
      },
      {
        name: 'users.password_hash_nullable',
        sql: `ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;`
      }
    ];

    for (const migration of migrations) {
      try {
        await db.execute(sql.raw(migration.sql));
        console.log(`    ✅ ${migration.name}`);
      } catch (error) {
        console.log(`    ⚠️  ${migration.name} - ${error}`);
      }
    }
  }

  private async seedSystemPermissions(): Promise<void> {
    console.log('  🔐 Seeding system permissions...');
    
    const systemPermissions = [
      // Core platform permissions
      { resource: 'dashboard', action: 'read', description: 'View dashboard and analytics' },
      { resource: 'settings', action: 'read', description: 'View organization settings' },
      { resource: 'settings', action: 'write', description: 'Modify organization settings' },
      
      // User management
      { resource: 'users', action: 'read', description: 'View users and roles' },
      { resource: 'users', action: 'write', description: 'Create and modify users' },
      { resource: 'users', action: 'delete', description: 'Delete users' },
      
      // Role management
      { resource: 'roles', action: 'read', description: 'View roles and permissions' },
      { resource: 'roles', action: 'write', description: 'Create and modify roles' },
      { resource: 'roles', action: 'delete', description: 'Delete roles' },
      
      // Server management
      { resource: 'servers', action: 'read', description: 'View servers' },
      { resource: 'servers', action: 'write', description: 'Create and modify servers' },
      { resource: 'servers', action: 'execute', description: 'Test server connections' },
      { resource: 'servers', action: 'delete', description: 'Delete servers' },
      
      // Server groups
      { resource: 'server-groups', action: 'read', description: 'View server groups' },
      { resource: 'server-groups', action: 'write', description: 'Create and modify server groups' },
      { resource: 'server-groups', action: 'execute', description: 'Manage server group operations' },
      { resource: 'server-groups', action: 'delete', description: 'Delete server groups' },
      
      // PEM key management
      { resource: 'pem-keys', action: 'read', description: 'View PEM keys' },
      { resource: 'pem-keys', action: 'write', description: 'Upload and modify PEM keys' },
      { resource: 'pem-keys', action: 'execute', description: 'Test PEM key connections' },
      { resource: 'pem-keys', action: 'delete', description: 'Delete PEM keys' },
      
      // Configuration management
      { resource: 'configurations', action: 'read', description: 'View configurations' },
      { resource: 'configurations', action: 'write', description: 'Create and modify configurations' },
      { resource: 'configurations', action: 'execute', description: 'Validate and test configurations' },
      { resource: 'configurations', action: 'approve', description: 'Approve or reject configurations for deployment' },
      { resource: 'configurations', action: 'delete', description: 'Delete configurations' },
      
      // Deployment management
      { resource: 'deployments', action: 'read', description: 'View deployments' },
      { resource: 'deployments', action: 'write', description: 'Create and modify deployments' },
      { resource: 'deployments', action: 'execute', description: 'Execute and redeploy configurations' },
      { resource: 'deployments', action: 'delete', description: 'Delete deployments' },
      
      // Training and chat
      { resource: 'training', action: 'read', description: 'Access infrastructure training modules' },
      { resource: 'chat', action: 'read', description: 'View configuration chat' },
      { resource: 'chat', action: 'write', description: 'Use AI configuration assistant' },
      { resource: 'chat', action: 'delete', description: 'Delete chat conversations' },
      
      // Audit logs
      { resource: 'audit-logs', action: 'view', description: 'View audit logs' },
      { resource: 'audit-logs', action: 'export', description: 'Export audit logs' },
      
      // AWS integrations
      { resource: 'aws-integrations', action: 'read', description: 'View AWS integrations' },
      { resource: 'aws-integrations', action: 'write', description: 'Create and modify AWS integrations' },
      { resource: 'aws-integrations', action: 'delete', description: 'Delete AWS integrations' },
      { resource: 'aws-integrations', action: 'sync', description: 'Sync AWS instances' },
      { resource: 'aws-integrations', action: 'import', description: 'Import AWS instances as servers' },
      
      // MDM management
      { resource: 'mdm', action: 'read', description: 'View MDM profiles and devices' },
      { resource: 'mdm', action: 'write', description: 'Create and modify MDM profiles' },
      { resource: 'mdm', action: 'execute', description: 'Send commands to MDM devices' },
      { resource: 'mdm', action: 'delete', description: 'Delete MDM profiles' },
      
      // GitHub integrations
      { resource: 'github-integrations', action: 'read', description: 'View GitHub integrations' },
      { resource: 'github-integrations', action: 'write', description: 'Create and modify GitHub integrations' },
      { resource: 'github-integrations', action: 'delete', description: 'Delete GitHub integrations' },
      { resource: 'github-integrations', action: 'validate', description: 'Validate GitHub tokens' },
      { resource: 'github-integrations', action: 'sync', description: 'Sync configurations to GitHub' },
      
      // Asset management
      { resource: 'asset', action: 'read', description: 'View assets' },
      { resource: 'asset', action: 'create', description: 'Create new assets' },
      { resource: 'asset', action: 'update', description: 'Update existing assets' },
      { resource: 'asset', action: 'delete', description: 'Delete assets' },
      { resource: 'asset', action: 'assign', description: 'Assign assets to users/locations' },
      { resource: 'asset', action: 'import', description: 'Import assets from external sources' },
      { resource: 'asset', action: 'export', description: 'Export assets to external systems' },
    ];

    let createdCount = 0;
    for (const perm of systemPermissions) {
      try {
        await db
          .insert(permissions)
          .values({
            resource: perm.resource,
            action: perm.action,
            description: perm.description,
          })
          .onConflictDoNothing();
        createdCount++;
      } catch (error) {
        console.error(`    ❌ Failed to create permission ${perm.resource}:${perm.action}:`, error);
      }
    }
    
    console.log(`    ✅ Verified ${systemPermissions.length} system permissions`);
  }

  private async updateOrganizationFeatures(): Promise<void> {
    console.log('  🏢 Updating organization feature flags...');
    
    const defaultFeatures = {
      servers: true,
      serverGroups: true,
      pemKeys: true,
      configurations: true,
      deployments: true,
      chat: true,
      training: true,
      awsIntegrations: true,
      githubIntegrations: true,
      mdm: true,
      assets: true,
      auditLogs: true,
    };

    try {
      // Update all organizations that don't have features_enabled set
      await db.execute(sql`
        UPDATE organizations 
        SET features_enabled = ${JSON.stringify(defaultFeatures)}::jsonb 
        WHERE features_enabled IS NULL
      `);
      
      console.log('    ✅ Organization feature flags updated');
    } catch (error) {
      console.error('    ❌ Failed to update organization features:', error);
      throw error;
    }
  }

  async verifyInstallation(): Promise<boolean> {
    console.log('🔍 Verifying installation...');
    
    try {
      // Check all required tables exist
      const requiredTables = [
        'assets', 'asset_assignments', 'github_integrations', 
        'configuration_github_mappings', 'permissions', 'roles', 
        'role_permissions', 'organizations', 'users'
      ];
      
      for (const table of requiredTables) {
        const result = await db.execute(sql`
          SELECT COUNT(*) as count 
          FROM information_schema.tables 
          WHERE table_name = ${table}
        `);
        if ((result[0] as any).count === 0) {
          console.error(`❌ Required table missing: ${table}`);
          return false;
        }
      }
      
      // Check permissions count
      const [permCount] = await db.execute(sql`SELECT COUNT(*) as count FROM permissions`);
      if ((permCount as any).count < 57) {
        console.error(`❌ Insufficient permissions: ${(permCount as any).count}/57`);
        return false;
      }
      
      console.log('✅ Installation verification passed');
      return true;
    } catch (error) {
      console.error('❌ Installation verification failed:', error);
      return false;
    }
  }
}
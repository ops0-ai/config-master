# Database Migrations Guide for Pulse Platform

## Overview

This guide covers how to properly handle database migrations for the Pulse platform using **Drizzle ORM** for new changes and maintaining backwards compatibility with existing SQL-based migrations.

## Current Migration System

### 1. **Drizzle ORM Migrations** (Recommended for new changes)

Located in: `apps/api/drizzle/`

#### Adding New Migrations with Drizzle

1. **Update Schema**: Modify `packages/database/src/schema.ts`
2. **Generate Migration**:
   ```bash
   cd apps/api
   npm run db:generate
   # or
   npx drizzle-kit generate
   ```
3. **Review Generated SQL**: Check the generated file in `apps/api/drizzle/`
4. **Apply Migration**:
   ```bash
   # Option 1: Use our migration script
   node migrate.js
   
   # Option 2: Use Drizzle directly
   cd apps/api
   npm run db:migrate
   ```

### 2. **Legacy SQL Migrations** (For backwards compatibility)

These are standalone `.sql` files in the project root for specific features:

- `comprehensive-upgrade.sql` - Complete schema
- `discovery-migration.sql` - Discovery feature tables
- `feature-flags-migration.sql` - Feature flags
- `email-case-insensitive-fix.sql` - Email normalization
- etc.

## Discovery Feature Migration

### Tables Created

1. **`discovery_sessions`** - Discovery session management
2. **`discovery_resources`** - Scanned cloud resources
3. **`discovery_code_generations`** - Generated infrastructure code

### Schema Definition

```typescript
// Located in: packages/database/src/schema.ts

export const discoverySession = pgTable('discovery_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  integrationId: uuid('integration_id').references(() => awsIntegrations.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }),
  description: text('description'),
  provider: varchar('provider', { length: 50 }).notNull().default('aws'),
  regions: jsonb('regions').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  resourceCount: integer('resource_count').default(0),
  metadata: jsonb('metadata').default({}),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

## Upgrade Process

### For Fresh Installations

Use `install.sh` - includes all migrations and setup.

### For Existing Installations

Use `upgrade.sh` - handles:

1. **Database Backup**: Automatic backup before migration
2. **Comprehensive Migration**: Tries full schema update first
3. **Individual Migrations**: Falls back to individual SQL files if needed
4. **Discovery Migration**: Includes discovery feature tables
5. **Verification**: Checks all tables and features are properly installed
6. **Container Rebuild**: Fresh build with latest code
7. **Health Checks**: Verifies everything is working

### Migration Order in upgrade.sh

1. Base database schema (`upgrade.sql`)
2. Feature flags (`feature-flags-migration.sql`)
3. RBAC permissions (`rbac-permissions-fix.sql`)
4. Email case fix (`email-case-insensitive-fix.sql`)
5. **Discovery feature** (`discovery-migration.sql`)

## Future Migration Best Practices

### 1. Always Use Drizzle for New Features

```typescript
// 1. Update schema.ts
export const newFeatureTable = pgTable('new_feature', {
  id: uuid('id').primaryKey().defaultRandom(),
  // ... other fields
});

// 2. Generate migration
// npx drizzle-kit generate

// 3. Review and apply
// node migrate.js
```

### 2. Maintain Feature Flags

Always update organization features when adding new functionality:

```sql
UPDATE organizations 
SET features_enabled = features_enabled || '{"newFeature": true}'::jsonb
WHERE features_enabled IS NOT NULL;
```

### 3. Add Proper Indexes

Include performance indexes for frequently queried fields:

```sql
CREATE INDEX IF NOT EXISTS idx_table_frequently_queried_field 
ON table_name(frequently_queried_field);
```

### 4. Handle Permissions (RBAC)

Add new permissions for new features:

```typescript
// Add to packages/database/src/schema.ts
// Update RBAC seeder in backend
```

## Migration Script Reference

### Using migrate.js

```bash
# Run all pending migrations
node migrate.js

# With environment variables
DB_HOST=localhost DB_PORT=5432 DB_USER=postgres DB_PASSWORD=postgres node migrate.js
```

### Using Drizzle Commands

```bash
cd apps/api

# Generate migration from schema changes
npm run db:generate

# Apply migrations
npm run db:migrate

# Push schema directly (dev only)
npm run db:push
```

## Verification

The `upgrade.sh` script includes comprehensive verification:

- ✅ Table existence checks
- ✅ Column existence checks  
- ✅ Feature flag verification
- ✅ Permission counts
- ✅ API endpoint testing
- ✅ Health checks

## Rollback Strategy

1. **Database Backup**: Every upgrade creates timestamped backup
2. **Manual Rollback**: Use backup to restore if needed
3. **Container Rollback**: Use previous Docker images

## Discovery Feature Verification

After running migrations, verify discovery feature:

1. **Database Tables**: Check `discovery_sessions`, `discovery_resources`, `discovery_code_generations` exist
2. **Feature Flag**: Verify `organizations.features_enabled` includes `"discovery": true`
3. **API Endpoints**: Test `/api/discovery/*` endpoints
4. **UI Access**: Check Discovery page is accessible at `/discovery`

## Environment Variables

Required for migrations:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=config_management
```

## Troubleshooting

### Common Issues

1. **Migration Fails**: Check database connectivity and permissions
2. **Table Already Exists**: Drizzle handles `IF NOT EXISTS` automatically
3. **Permission Errors**: Ensure database user has CREATE permissions
4. **Connection Timeout**: Increase connection timeout in production

### Getting Help

1. Check migration logs: `docker compose logs api`
2. Check database logs: `docker compose logs db`
3. Manual verification: Connect to database and check tables
4. Rollback: Use timestamped backup file created during upgrade

## Summary

- ✅ **Discovery feature fully integrated** with proper Drizzle migrations
- ✅ **Backwards compatible** with existing SQL-based system
- ✅ **Automated upgrades** via `upgrade.sh` 
- ✅ **Future-ready** with Drizzle ORM for new features
- ✅ **Comprehensive verification** and health checks
- ✅ **Rollback safety** with automatic backups
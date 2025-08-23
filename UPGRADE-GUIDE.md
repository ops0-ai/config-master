# 🔄 ConfigMaster Asset Management Upgrade Guide

## ⚠️ Pre-Upgrade Checklist

### 1. **Create Database Backup**
```bash
# Create timestamped backup
BACKUP_FILE="configmaster_backup_$(date +%Y%m%d_%H%M%S).sql"
docker exec configmaster-db pg_dump -U postgres -d config_management > "$BACKUP_FILE"
echo "Backup created: $BACKUP_FILE"
```

### 2. **Backup Docker Volumes** (Optional but Recommended)
```bash
# Stop containers
docker-compose down

# Create volume backups
docker run --rm -v config-management_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_data_backup.tar.gz -C /data .
docker run --rm -v config-management_pem_keys:/data -v $(pwd):/backup alpine tar czf /backup/pem_keys_backup.tar.gz -C /data .
```

### 3. **Note Current Version**
```bash
# Check current git commit
git log --oneline -1

# Save current docker images
docker images | grep config-management > current_images.txt
```

## 🚀 Upgrade Methods

### Method 1: **Automated Upgrade** (Recommended)
```bash
# Run the upgrade script
./upgrade-existing.sh
```

### Method 2: **Manual Upgrade**

#### Step 1: Stop System
```bash
docker-compose down
```

#### Step 2: Rebuild Containers
```bash
# Pull latest changes (if using git)
git pull origin main

# Rebuild with latest code
docker-compose build --no-cache
```

#### Step 3: Start System
```bash
docker-compose up -d
```

#### Step 4: Verify Upgrade
```bash
# Check system status
docker-compose ps

# Check asset tables were created
docker exec configmaster-db psql -U postgres -d config_management -c "\dt asset*"

# Check RBAC seeding completed
docker-compose logs api | grep "RBAC seeding completed"
```

## 🔍 Post-Upgrade Verification

### 1. **Database Verification**
```bash
# Check asset tables exist
docker exec configmaster-db psql -U postgres -d config_management -c "
SELECT table_name FROM information_schema.tables 
WHERE table_name LIKE 'asset%' 
ORDER BY table_name;"

# Should show:
# - assets
# - asset_assignments  
# - asset_categories
# - asset_custom_fields
# - asset_custom_field_values
# - asset_history
# - asset_locations
# - asset_maintenance
```

### 2. **RBAC Permissions Verification**
```bash
# Check asset permissions exist
docker exec configmaster-db psql -U postgres -d config_management -c "
SELECT resource, action, description 
FROM permissions 
WHERE resource = 'asset' 
ORDER BY action;"

# Should show asset:read, asset:create, asset:update, asset:delete, asset:assign, asset:import, asset:export
```

### 3. **API Endpoints Verification**
```bash
# Test asset endpoints (replace TOKEN with actual login token)
curl -H "Authorization: Bearer TOKEN" http://localhost:5005/api/assets
curl -H "Authorization: Bearer TOKEN" http://localhost:5005/api/asset-assignments
```

### 4. **Frontend Verification**
- Login to http://localhost:3000
- Navigate to Assets section (should appear in sidebar)
- Create a test asset
- Assign asset to user (green + icon)
- Verify reassignment icon appears (blue user icon)
- Check Settings → Roles → Administrator role has asset permissions

## 🔄 Rollback Procedures

### If Upgrade Fails:

#### 1. **Quick Rollback**
```bash
# Stop current system
docker-compose down

# Restore from database backup
docker-compose up -d database
sleep 10
cat your_backup_file.sql | docker exec -i configmaster-db psql -U postgres -d config_management

# Start system with previous images
docker-compose up -d
```

#### 2. **Complete Rollback with Volume Restore**
```bash
# Stop and remove everything
docker-compose down -v

# Restore volume backups
docker run --rm -v config-management_postgres_data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres_data_backup.tar.gz -C /data
docker run --rm -v config-management_pem_keys:/data -v $(pwd):/backup alpine tar xzf /backup/pem_keys_backup.tar.gz -C /data

# Start system
docker-compose up -d
```

## 🆕 New Features After Upgrade

### Asset Management
- ✅ Create, update, delete assets
- ✅ Asset assignment to users
- ✅ Reassignment support with history
- ✅ Asset status tracking (available/assigned/maintenance)
- ✅ Asset specifications and custom fields
- ✅ Import/export functionality

### UI Improvements  
- ✅ Green UserPlusIcon for available assets (assign)
- ✅ Blue UserIcon for assigned assets (reassign)
- ✅ Dynamic modal titles (Assign vs Reassign Asset)
- ✅ Assignment history and tracking

### RBAC Integration
- ✅ Asset permissions in role matrix
- ✅ Granular permissions (read, create, update, delete, assign, import, export)
- ✅ Role-based access control for all asset operations

## 🆘 Troubleshooting

### Common Issues:

#### 1. **"Asset permissions not showing"**
```bash
# Re-run RBAC seeding
docker exec configmaster-api npm run db:seed
```

#### 2. **"Asset tables missing"**
```bash
# Check migration status
docker-compose logs api | grep "0010_asset_management"

# If migration didn't run, restart API
docker-compose restart api
```

#### 3. **"Permission denied errors"**
```bash
# Check user roles have asset permissions
docker exec configmaster-db psql -U postgres -d config_management -c "
SELECT r.name, p.resource, p.action 
FROM roles r
JOIN role_permissions rp ON r.id = rp.role_id  
JOIN permissions p ON rp.permission_id = p.id
WHERE p.resource = 'asset' AND r.name = 'Administrator';"
```

#### 4. **"Frontend not showing new features"**
```bash
# Clear browser cache and hard reload
# Or rebuild web container
docker-compose build web
docker-compose up -d web
```

## 📞 Support

If you encounter issues during upgrade:
1. Check the logs: `docker-compose logs api`
2. Verify database connectivity: `docker-compose logs database`
3. Ensure all containers are healthy: `docker-compose ps`
4. Restore from backup if needed (see rollback procedures)

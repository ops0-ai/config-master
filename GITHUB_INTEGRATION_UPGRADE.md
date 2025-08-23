# ConfigMaster GitHub Integration Upgrade Guide

This guide explains how to upgrade existing ConfigMaster installations to support the new GitHub integration features.

## 🌟 New Features

The GitHub integration update adds:

- **Import from GitHub**: Import configurations directly from GitHub repositories
- **Sync to GitHub**: Push configurations back to GitHub repositories  
- **Directory Structure Preservation**: Maintain original file paths and directory structure
- **Metadata Tracking**: Track source repository, branch, and path information
- **Visual Integration**: Clear indication of imported files and their source

## 🔄 Upgrading Existing Installation

### Option 1: Automated Upgrade (Recommended)

1. **Navigate to your ConfigMaster directory**:
   ```bash
   cd /path/to/your/config-management
   ```

2. **Ensure ConfigMaster is running**:
   ```bash
   docker-compose up -d
   ```

3. **Run the upgrade script**:
   ```bash
   ./upgrade.sh
   ```

The script will:
- Create a database backup
- Add the metadata column to configurations table
- Create GitHub integration tables
- Restart containers
- Verify the upgrade

### Option 2: Manual Upgrade

If you prefer to run the upgrade manually:

1. **Backup your database**:
   ```bash
   docker exec configmaster-db pg_dump -U postgres -d config_management > backup.sql
   ```

2. **Apply the upgrade SQL**:
   ```bash
   docker exec -i configmaster-db psql -U postgres -d config_management < upgrade.sql
   ```

3. **Restart containers**:
   ```bash
   docker-compose restart api web
   ```

## ✅ Fresh Installation

For fresh installations, simply use the latest docker-compose.yml and run:

```bash
docker-compose up -d
```

All GitHub integration tables will be created automatically during the initial database setup.

## 🔧 Post-Upgrade Setup

After upgrading:

1. **Access ConfigMaster**: Navigate to `http://localhost:3000`

2. **Configure GitHub Integration**:
   - Go to **Settings > Integrations**
   - Add a new GitHub integration
   - Provide your GitHub Personal Access Token
   - Select repositories to integrate

3. **Start Using GitHub Features**:
   - **Import**: Go to Configurations page and click "Import" to import from GitHub
   - **Sync**: Edit any configuration and use "Sync with GitHub" to push changes

## 🗂️ Database Schema Changes

The upgrade adds:

### New Tables:
- `github_integrations` - Stores GitHub repository connections
- `configuration_github_mappings` - Maps configurations to GitHub files
- `github_pull_requests` - Tracks GitHub pull requests

### Modified Tables:
- `configurations` - Added `metadata` JSONB column for storing import information

## 🛠️ Troubleshooting

### Common Issues:

**1. "Container not found" error**
- Ensure ConfigMaster is running: `docker-compose ps`
- If not running: `docker-compose up -d`

**2. "Permission denied" error**
- Make upgrade script executable: `chmod +x upgrade.sh`

**3. Database connection issues**
- Wait a few seconds for database to be ready
- Check database health: `docker-compose logs db`

**4. GitHub features not working**
- Verify tables were created: 
  ```bash
  docker exec configmaster-db psql -U postgres -d config_management -c "\d github_integrations"
  ```

### Rollback Process:

If you need to rollback (use your backup file):

```bash
# Stop containers
docker-compose down

# Restore database
docker-compose up -d db
sleep 10
docker exec -i configmaster-db psql -U postgres -d config_management < your_backup_file.sql

# Start all containers
docker-compose up -d
```

## 🎯 Compatibility

- **Minimum Docker version**: 20.0+
- **Minimum docker-compose version**: 1.28+
- **Supported databases**: PostgreSQL 15+

## 📞 Support

If you encounter issues:

1. Check the upgrade logs for specific error messages
2. Verify your database backup was created successfully
3. Ensure you have sufficient disk space and permissions
4. Check Docker container logs: `docker-compose logs`

## 🔐 Security Notes

- GitHub Personal Access Tokens are encrypted in the database
- Backup files may contain sensitive data - store securely
- Only grant necessary GitHub permissions (repository access)

---

**✅ That's it! Your ConfigMaster installation now supports GitHub integration.**

Happy automating! 🚀
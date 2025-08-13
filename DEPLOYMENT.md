# ConfigMaster - Single-Click Deployment Guide

This guide provides seamless deployment options for ConfigMaster on any server.

## 🚀 Quick Start (Recommended)

### **One-Command Deployment**

```bash
git clone <your-repository-url>
cd config-management
./deploy.sh
./start.sh
```

**That's it!** ConfigMaster will be running with:
- **Web Interface**: http://localhost:3000
- **API**: http://localhost:5005/api
- **Default Admin**: admin@configmaster.dev / admin123

## 📋 What Gets Deployed

- ✅ **PostgreSQL Database** (Docker container)
- ✅ **Node.js API Server** with all dependencies
- ✅ **Next.js Web Application** 
- ✅ **Auto-created Admin User**
- ✅ **MDM Profile Management**
- ✅ **Real-time Device Monitoring**

## 🛠️ Prerequisites

- **Node.js 18+** ([Install](https://nodejs.org/))
- **Docker** ([Install](https://docs.docker.com/get-docker/))
- **Git**
- **4GB+ RAM**
- **10GB+ Disk Space**

## 📖 Deployment Methods

### Method 1: Automated Script (Recommended)

```bash
# Clone repository
git clone <your-repository-url>
cd config-management

# Deploy everything
./deploy.sh

# Start services
./start.sh
```

### Method 2: Docker Compose

```bash
# Clone repository
git clone <your-repository-url>
cd config-management

# Single command deployment
./docker-setup.sh
```

### Method 3: Manual Steps

```bash
# 1. Install dependencies
npm install

# 2. Build packages
cd packages/database && npm run build && cd ../..
cd packages/ansible-engine && npm run build && cd ../..
cd apps/api && npm run build && cd ../..
cd apps/web && npm run build && cd ../..

# 3. Start database
docker run -d \
  --name postgres-dev \
  -e POSTGRES_DB=config_management \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password123 \
  -p 5432:5432 \
  postgres:15-alpine

# 4. Setup environment
cd apps/api
cp .env.example .env
# Edit .env with your settings

# 5. Run migrations
npm run db:push

# 6. Start services
# Terminal 1:
npm run dev

# Terminal 2:
cd ../web && npm run dev
```

## 🔐 Default Credentials

ConfigMaster automatically creates an admin user on first startup:

- **Email**: `admin@configmaster.dev`
- **Password**: `admin123`

⚠️ **IMPORTANT**: Change these credentials immediately in production!

## 🌐 Access Points

After deployment:

| Service | URL | Description |
|---------|-----|-------------|
| **Web App** | http://localhost:3000 | Main interface |
| **API** | http://localhost:5005/api | REST API |
| **Health** | http://localhost:5005/health | Health check |
| **Database** | localhost:5432 | PostgreSQL |

## 📱 MDM Agent Installation

Once deployed, install agents on devices:

1. **Get Enrollment Key**: 
   - Login to web interface
   - Go to MDM section
   - Copy enrollment key

2. **Install Agent**:
   ```bash
   curl -L "http://your-server:5005/api/mdm/download/agent-installer" | bash -s YOUR_ENROLLMENT_KEY
   ```

## 🔧 Configuration

### Environment Variables

Edit `apps/api/.env`:

```bash
# Database
DATABASE_URL=postgresql://postgres:password123@localhost:5432/config_management

# Security (CHANGE IN PRODUCTION!)
JWT_SECRET=your-super-secret-jwt-key
ENCRYPTION_KEY=your-32-character-encryption-key
MASTER_ENCRYPTION_KEY=your-master-encryption-key

# API
PORT=5005
FRONTEND_URL=http://localhost:3000

# Optional Integrations
OPENAI_API_KEY=your-openai-key
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
GITHUB_CLIENT_ID=your-github-id
GITHUB_CLIENT_SECRET=your-github-secret
```

### Production Security

For production deployments:

1. **Change Default Passwords**:
   ```bash
   # Generate secure secrets
   openssl rand -hex 32  # For JWT_SECRET
   openssl rand -hex 16  # For ENCRYPTION_KEY
   ```

2. **Use Environment Variables**:
   ```bash
   export JWT_SECRET="your-secure-secret"
   export DATABASE_URL="your-production-db-url"
   ```

3. **Enable HTTPS**:
   - Use reverse proxy (nginx/Apache)
   - Configure SSL certificates
   - Update FRONTEND_URL to https://

## 🐛 Troubleshooting

### Common Issues

**Database Connection Failed**:
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Restart database
docker restart postgres-dev
```

**Port Already in Use**:
```bash
# Check what's using the port
lsof -i :3000
lsof -i :5005

# Kill the process
kill -9 <PID>
```

**Build Errors**:
```bash
# Clean and rebuild
rm -rf node_modules package-lock.json
npm install
```

**Permission Errors**:
```bash
# Make scripts executable
chmod +x deploy.sh start.sh docker-setup.sh
```

### Logs

```bash
# View API logs
tail -f api.log

# View Web logs  
tail -f web.log

# View database logs
docker logs postgres-dev
```

### Reset Everything

```bash
# Stop all services
./stop.sh  # or Ctrl+C

# Remove database
docker rm -f postgres-dev

# Clean build
rm -rf node_modules apps/*/node_modules packages/*/node_modules
rm -rf apps/api/dist apps/web/.next packages/*/dist

# Redeploy
./deploy.sh
```

## 🚀 Production Deployment

### Using Docker Compose

```bash
# Production deployment with SSL
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Using PM2 (Process Manager)

```bash
# Install PM2
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'configmaster-api',
    cwd: './apps/api',
    script: 'npm',
    args: 'start',
    env: {
      NODE_ENV: 'production'
    }
  }, {
    name: 'configmaster-web',
    cwd: './apps/web',
    script: 'npm',
    args: 'start',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
EOF

# Deploy with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 📊 Monitoring

### Health Checks

```bash
# API health
curl http://localhost:5005/health

# Database health
PGPASSWORD=password123 psql -h localhost -U postgres -d config_management -c "SELECT 1;"
```

### Metrics

- **API Performance**: Check logs for response times
- **Database**: Monitor connection counts and query performance  
- **Memory Usage**: Monitor Node.js heap usage
- **Disk Space**: Monitor log files and database size

## 🔄 Updates

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
./deploy.sh
./start.sh
```

## 📞 Support

### Quick Diagnostics

```bash
# Run diagnostic script
cat > diagnose.sh << 'EOF'
#!/bin/bash
echo "🔍 ConfigMaster Diagnostics"
echo "=========================="
echo "Node.js: $(node --version)"
echo "Docker: $(docker --version)"
echo "Git: $(git --version)"
echo ""
echo "Database: $(docker ps | grep postgres || echo 'NOT RUNNING')"
echo "API: $(curl -s http://localhost:5005/health || echo 'NOT RESPONDING')"
echo "Web: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000 || echo 'NOT RESPONDING')"
EOF

chmod +x diagnose.sh
./diagnose.sh
```

### Getting Help

1. **Check logs first**: `tail -f api.log web.log`
2. **Run diagnostics**: `./diagnose.sh`
3. **Check GitHub issues**: Create issue with logs
4. **Community support**: Join our Discord/Slack

---

## 🎯 Summary

**For new deployments**:
```bash
git clone <repo> && cd config-management && ./deploy.sh && ./start.sh
```

**Default access**:
- URL: http://localhost:3000
- Login: admin@configmaster.dev / admin123

**That's it!** ConfigMaster is production-ready with this simple deployment.
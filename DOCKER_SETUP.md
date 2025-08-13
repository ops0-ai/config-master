# ConfigMaster Docker Setup

This guide explains how to quickly set up ConfigMaster using Docker Compose on any machine.

## 🚀 Quick Start

### Prerequisites
- Docker (20.10+)
- Docker Compose (2.0+)
- 4GB+ RAM
- 10GB+ disk space

### One-Command Setup

```bash
git clone <repository-url>
cd config-management
./docker-setup.sh
```

The setup script will automatically:
- ✅ Check Docker installation
- ✅ Create necessary directories
- ✅ Build and start all services
- ✅ Run database migrations
- ✅ Seed initial data

## 📋 Manual Setup

If you prefer manual setup:

### 1. Clone and Configure
```bash
git clone <repository-url>
cd config-management
cp .env.example .env
# Edit .env with your settings
```

### 2. Start Services
```bash
docker-compose up -d
```

### 3. Initialize Database
```bash
# Wait for database to be ready
docker-compose exec api npm run db:push
docker-compose exec api npm run db:seed
```

## 🌐 Access Points

After setup completes:

- **Web Interface**: http://localhost:3000
- **API Endpoint**: http://localhost:5005/api
- **Database**: localhost:5432 (postgres/password123)
- **Redis**: localhost:6379

## 👤 Default Credentials

- **Email**: admin@configmaster.dev
- **Password**: admin123

⚠️ **Change these in production!**

## 🔧 Services Overview

| Service | Container | Port | Description |
|---------|-----------|------|-------------|
| Web | configmaster-web | 3000 | Next.js frontend |
| API | configmaster-api | 5005 | Express.js backend |
| Database | configmaster-db | 5432 | PostgreSQL 15 |
| Redis | configmaster-redis | 6379 | Caching & sessions |

## 📱 MDM Agent Installation

Once the platform is running, install agents on devices:

```bash
# Get enrollment key from MDM page in web interface
curl -L "http://localhost:5005/api/mdm/download/agent-installer" | bash -s YOUR_ENROLLMENT_KEY
```

## 🛠️ Common Commands

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f web
```

### Restart Services
```bash
# All services
docker-compose restart

# Specific service
docker-compose restart api
```

### Stop Services
```bash
docker-compose down
```

### Update Images
```bash
docker-compose pull
docker-compose up -d
```

### Database Operations
```bash
# Access database
docker-compose exec database psql -U postgres -d config_management

# Backup database
docker-compose exec database pg_dump -U postgres config_management > backup.sql

# Restore database
docker-compose exec -T database psql -U postgres -d config_management < backup.sql
```

## 🔐 Production Deployment

For production deployment:

### 1. Use Production Compose File
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 2. Set Production Environment Variables
```bash
# Create .env with production values
DB_PASSWORD=your-secure-db-password
JWT_SECRET=your-super-secret-jwt-key-at-least-64-characters-long
ENCRYPTION_KEY=your-32-character-encryption-key
MASTER_ENCRYPTION_KEY=your-master-key-for-pem-encryption
REDIS_PASSWORD=your-redis-password
```

### 3. Configure SSL/TLS
```bash
# Place SSL certificates in nginx/ssl/
mkdir -p nginx/ssl
# Add your certificates: cert.pem, key.pem
```

### 4. Security Checklist
- [ ] Change all default passwords
- [ ] Configure firewall rules
- [ ] Enable SSL/TLS certificates
- [ ] Set up regular backups
- [ ] Configure monitoring
- [ ] Review security headers

## 🐛 Troubleshooting

### Services Won't Start
```bash
# Check container status
docker-compose ps

# View service logs
docker-compose logs <service-name>

# Restart problematic service
docker-compose restart <service-name>
```

### Database Connection Issues
```bash
# Check database is running
docker-compose exec database pg_isready -U postgres

# Reset database
docker-compose down -v
docker-compose up -d
```

### Port Conflicts
If ports 3000, 5005, or 5432 are in use:

1. Edit `docker-compose.yml`
2. Change port mappings (e.g., `"3001:3000"`)
3. Restart services

### Build Issues
```bash
# Force rebuild
docker-compose build --no-cache
docker-compose up -d
```

## 📊 Performance Tuning

### Database Optimization
```yaml
# In docker-compose.yml, add to database service:
command: |
  postgres
  -c shared_preload_libraries=pg_stat_statements
  -c max_connections=200
  -c shared_buffers=256MB
  -c effective_cache_size=1GB
```

### Redis Configuration
```yaml
# Add to redis service:
command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
```

## 🔄 Updates

To update ConfigMaster:

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --pull
docker-compose up -d

# Run any new migrations
docker-compose exec api npm run db:push
```

## 📞 Support

- **Documentation**: Check README.md files
- **Logs**: Always check `docker-compose logs -f`
- **Issues**: Create GitHub issues with logs
- **Community**: Join our Discord/Slack

## 🗂️ File Structure

```
config-management/
├── docker-compose.yml          # Main compose file
├── docker-compose.prod.yml     # Production overrides
├── docker-setup.sh            # Automated setup script
├── .env.example               # Environment template
├── apps/
│   ├── api/
│   │   └── Dockerfile         # API Docker image
│   └── web/
│       └── Dockerfile         # Web Docker image
├── uploads/                   # Persistent uploads
├── logs/                      # Application logs
└── secure/                    # PEM keys storage
```

This setup provides a complete, production-ready ConfigMaster deployment with minimal configuration required.
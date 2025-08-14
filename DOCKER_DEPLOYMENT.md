# Docker Deployment Guide

## 🚀 Quick Start

Run ConfigMaster with a single command:

```bash
./docker-start.sh
```

Access the application:
- 🌐 Web Interface: http://localhost:3000
- 🔌 API Endpoint: http://localhost:5005/api
- 📧 Default Login: admin@configmaster.dev / admin123

## 📦 Files Overview

### Docker Compose Files
- `docker-compose.working.yml` - Production-ready setup with PostgreSQL, API, and Web
- `docker-compose.simple.yml` - Minimal setup for testing
- `docker-compose.yml` - Full setup with Redis and Nginx (advanced)

### Dockerfiles
- `Dockerfile.api` - Multi-stage build for API server
- `Dockerfile.web` - Multi-stage build for Next.js web app
- `apps/api/Dockerfile.simple` - Simple single-stage API build
- `apps/web/Dockerfile.simple` - Simple single-stage web build

### Scripts
- `docker-start.sh` - Main startup script with health checks
- `docker-run.sh` - Alternative startup script
- `deploy.sh` - Local deployment without Docker

## 🛠️ Commands

### Start Services
```bash
# Normal start
./docker-start.sh

# Fresh start (removes old data)
./docker-start.sh --fresh

# Using docker compose directly
docker compose -f docker-compose.working.yml up -d
```

### View Logs
```bash
# All services
docker compose -f docker-compose.working.yml logs -f

# API only
docker compose -f docker-compose.working.yml logs -f api

# Web only
docker compose -f docker-compose.working.yml logs -f web

# Database
docker compose -f docker-compose.working.yml logs -f postgres
```

### Stop Services
```bash
# Stop containers
docker compose -f docker-compose.working.yml down

# Stop and remove volumes (data)
docker compose -f docker-compose.working.yml down -v
```

### Rebuild After Code Changes
```bash
# Rebuild images
docker compose -f docker-compose.working.yml build

# Rebuild without cache
docker compose -f docker-compose.working.yml build --no-cache

# Rebuild and restart
docker compose -f docker-compose.working.yml up -d --build
```

## 🔧 Configuration

### Environment Variables
Copy `.env.docker` to `.env` and customize:

```bash
cp .env.docker .env
# Edit .env with your values
```

Important variables to change for production:
- `JWT_SECRET` - Authentication secret
- `ENCRYPTION_KEY` - Data encryption key
- `MASTER_ENCRYPTION_KEY` - PEM file encryption
- `POSTGRES_PASSWORD` - Database password

### Ports
Default ports (configurable in docker-compose.yml):
- `3000` - Web interface
- `5005` - API server
- `5432` - PostgreSQL database

## 🐛 Troubleshooting

### Container won't start
```bash
# Check logs
docker compose -f docker-compose.working.yml logs api

# Check container status
docker ps -a

# Remove everything and start fresh
docker compose -f docker-compose.working.yml down -v
./docker-start.sh --fresh
```

### Can't connect to database
```bash
# Check if database is running
docker compose -f docker-compose.working.yml ps postgres

# Check database logs
docker compose -f docker-compose.working.yml logs postgres

# Test database connection
docker compose -f docker-compose.working.yml exec postgres psql -U postgres -d config_management
```

### Build failures
```bash
# Clean Docker cache
docker system prune -a

# Rebuild with no cache
docker compose -f docker-compose.working.yml build --no-cache
```

### Port already in use
```bash
# Find what's using the port
lsof -i :3000  # or :5005, :5432

# Kill the process
kill -9 <PID>

# Or change the port in docker-compose.yml
```

## 🔒 Security Notes

For production deployment:
1. Change all default passwords
2. Use strong JWT secrets (generate with `openssl rand -base64 32`)
3. Enable HTTPS with proper SSL certificates
4. Use Docker secrets for sensitive data
5. Restrict database access
6. Set up proper firewall rules

## 📊 Health Checks

Check service health:
```bash
# API health
curl http://localhost:5005/health

# Database health
docker compose -f docker-compose.working.yml exec postgres pg_isready

# Container health
docker compose -f docker-compose.working.yml ps
```

## 🔄 Backup & Restore

### Backup Database
```bash
# Backup to file
docker compose -f docker-compose.working.yml exec postgres pg_dump -U postgres config_management > backup.sql

# Backup with timestamp
docker compose -f docker-compose.working.yml exec postgres pg_dump -U postgres config_management > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore Database
```bash
# Restore from file
docker compose -f docker-compose.working.yml exec -T postgres psql -U postgres config_management < backup.sql
```

## 📈 Scaling

For production scaling:
1. Use external PostgreSQL (RDS, Cloud SQL)
2. Add Redis for caching
3. Use load balancer for multiple API instances
4. Consider Kubernetes for orchestration

## 🆘 Support

If you encounter issues:
1. Check the logs first
2. Ensure Docker and Docker Compose are up to date
3. Try a fresh start with `./docker-start.sh --fresh`
4. Check system resources (disk space, memory)
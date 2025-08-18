# Pulse Configuration Management - Installation Guide

## Quick Start

For installation on any server:

```bash
# 1. Clone the repository
git clone <repository-url>
cd config-management

# 2. Switch to the stable branch
git checkout feature/fixing-docker

# 3. For clean installation (removes everything first)
./cleanup.sh && ./install.sh

# OR for installation without cleanup
./install.sh
```

## Manual Installation Steps

If you prefer manual installation:

### 1. Prerequisites
- Docker and Docker Compose installed
- Git installed
- At least 4GB RAM and 10GB disk space

### 2. Environment Setup (Optional)

#### Option A: Using .env file (Recommended)
Create a `.env` file in the project root:
```bash
# Admin credentials
DEFAULT_ADMIN_EMAIL=admin@yourcompany.com
DEFAULT_ADMIN_PASSWORD=your-secure-password

# Other environment variables...
FRONTEND_URL=https://your-domain.com
NEXT_PUBLIC_API_URL=https://your-domain.com/api
```

#### Option B: Using environment variables
```bash
# Set custom admin credentials (optional)
export DEFAULT_ADMIN_EMAIL="your-admin@company.com"
export DEFAULT_ADMIN_PASSWORD="your-secure-password"
```

### 3. Installation Options

#### Option A: Fresh Installation (Clean Start)
```bash
# Clean everything first
./cleanup.sh

# Then install
./install.sh
```

#### Option B: Install/Update without cleanup
```bash
# Install or update existing deployment
./install.sh
```

#### Option C: Manual Installation
```bash
# Build and start
docker compose up --build -d
```

### 4. Verify Installation
- Web UI: http://localhost:3000
- API Health: http://localhost:5005/health
- Default login: admin@pulse.dev / password123

## For Production Deployment

### 1. Environment Variables
Create a `.env` file:
```bash
# Database
DATABASE_URL=postgresql://postgres:your-db-password@database:5432/config_management
DB_PASSWORD=your-secure-db-password

# Security
JWT_SECRET=your-super-secret-jwt-key-change-in-production
ENCRYPTION_KEY=your-32-character-encryption-key
MASTER_ENCRYPTION_KEY=your-master-key-for-pem-files

# Admin User
DEFAULT_ADMIN_EMAIL=admin@yourcompany.com
DEFAULT_ADMIN_PASSWORD=your-secure-admin-password

# Frontend
FRONTEND_URL=https://your-domain.com
NEXT_PUBLIC_API_URL=https://your-domain.com/api

# AWS (Optional)
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_REGION=us-east-1

# GitHub (Optional)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

### 2. Production Docker Compose
Update the docker-compose.yml environment variables to use your `.env` file values.

### 3. HTTPS Setup
- Configure reverse proxy (nginx/traefik)
- Set up SSL certificates
- Update FRONTEND_URL and NEXT_PUBLIC_API_URL

## Troubleshooting

### Database Issues
```bash
# Check database logs
docker logs configmaster-db

# Connect to database
docker exec -it configmaster-db psql -U postgres -d config_management

# Check tables
\dt
```

### API Issues
```bash
# Check API logs
docker logs configmaster-api

# Restart API only
docker compose restart api
```

### Complete Reset
```bash
# Nuclear option - removes everything
./cleanup.sh

# Then reinstall
./fresh-install.sh
```

## Support

If you encounter issues:
1. Check the logs: `docker logs configmaster-api`
2. Verify all containers are running: `docker ps`
3. Check database connectivity: `docker exec configmaster-db pg_isready`
4. Test API health: `curl http://localhost:5005/health`

## Features Included

✅ Multi-tenant organization management  
✅ Role-based access control (RBAC)  
✅ MDM device management  
✅ Configuration deployment system  
✅ AWS integration  
✅ GitHub integration  
✅ Audit logging  
✅ Real-time device monitoring  
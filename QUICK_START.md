# 🚀 Quick Start Guide - ConfigMaster on Port 5005

## ✅ Current Status
- ✅ Project structure complete 
- ✅ TypeScript configuration fixed
- ✅ All dependencies installed
- ✅ Database schema ready
- ✅ API server configured for port 5005

## 🔧 Start the Application

### 1. Set Up Environment Variables
```bash
# Copy the environment file
cp .env.example apps/api/.env

# Edit the .env file and add your configuration:
# - Database credentials (PostgreSQL must be running)
# - OpenAI API key (for AI features)
# - Secure JWT and encryption keys
```

### 2. Database Setup
```bash
# Ensure PostgreSQL is running
# Create the database
createdb config_management

# Push the schema (from root directory)
npm run db:push
```

### 3. Start the Servers
```bash
# Option A: Start both servers with turbo
npm run dev

# Option B: Start individually
# Terminal 1 - API Server
cd apps/api
npm run dev  # Runs on http://localhost:5005

# Terminal 2 - Web Frontend
cd apps/web  
npm run dev  # Runs on http://localhost:3000
```

## 🌐 Access Points

- **Frontend**: http://localhost:3000
- **API Server**: http://localhost:5005
- **Health Check**: http://localhost:5005/health
- **API Documentation**: http://localhost:5005/api

## ✨ Features Available

1. **Conversational AI Interface**: 
   - Natural language to Ansible playbook generation
   - Real-time chat with configuration preview

2. **Server Management**:
   - Add/manage servers with SSH credentials
   - Secure PEM key storage and encryption
   - Server grouping and organization

3. **Configuration Drift Detection**:
   - Automated hourly drift scanning
   - State comparison and compliance tracking
   - Real-time alerts and remediation

4. **Enterprise Features**:
   - Multi-tenant architecture
   - Role-based access control
   - Audit logging and compliance
   - Real-time deployment tracking

## 🔑 Default Credentials

For development, you can register a new account through the frontend interface.

## 🐛 Troubleshooting

### API Server Won't Start
```bash
# Kill existing processes
lsof -ti:5005 | xargs kill -9

# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Restart API server
cd apps/api && npm run dev
```

### Frontend Issues
```bash
# Clear Next.js cache
cd apps/web
rm -rf .next
npm run dev
```

### Database Issues
```bash
# Reset database
dropdb config_management
createdb config_management
npm run db:push
```

## 📚 API Endpoints

- `GET /health` - Health check
- `POST /api/auth/login` - Authentication
- `POST /api/auth/register` - User registration
- `GET /api/servers` - Server management
- `GET /api/conversations` - AI chat interface
- `POST /api/ansible/execute` - Run Ansible playbooks

## 🎯 Next Steps

1. Configure your environment variables
2. Add your OpenAI API key for AI features
3. Start adding servers and PEM keys
4. Begin conversational configuration management!

---
**ConfigMaster** - Enterprise configuration management with AI-powered automation.
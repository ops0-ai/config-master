# ConfigMaster - Enterprise Configuration Management Platform

A comprehensive SaaS platform for infrastructure configuration management featuring conversational AI-powered Ansible automation, drift detection, and enterprise-grade security.

## 🚀 Features

### Core Functionality
- **Conversational AI Interface**: Natural language configuration requests that generate Ansible playbooks
- **Server Management**: Centralized server inventory with grouping and PEM key association  
- **Secure Key Management**: Encrypted storage and rotation of SSH private keys
- **Configuration Drift Detection**: Automated monitoring and alerting for configuration deviations
- **Real-time Deployments**: Execute Ansible configurations with live progress tracking
- **Audit Logging**: Complete activity tracking for compliance and security

### Enterprise Features
- **Multi-tenancy**: Organization-based isolation and access control
- **Role-based Access Control**: Granular permissions for team collaboration
- **State Management**: Track expected vs actual server configurations
- **Template Library**: Reusable configuration templates and patterns
- **Dashboard Analytics**: Infrastructure health and deployment metrics

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Node.js, Express, TypeScript, Socket.io
- **Database**: PostgreSQL with Drizzle ORM
- **AI Integration**: OpenAI GPT-4 for configuration generation
- **Infrastructure**: Ansible for configuration management
- **Security**: AES-256-GCM encryption, JWT authentication

### Project Structure
```
config-management/
├── apps/
│   ├── web/           # Next.js frontend application
│   └── api/           # Express.js backend API
├── packages/
│   ├── database/      # Shared database schema and utilities
│   ├── ansible-engine/# Ansible playbook generation and execution
│   └── ui/           # Shared UI components (future)
├── docs/             # Documentation
└── deploy/           # Deployment configurations
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 13+
- OpenAI API key
- Ansible installed on the server

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd config-management
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   
   Create `.env` files in both `apps/api` and `apps/web`:

   **apps/api/.env**
   ```env
   # Database
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=your_password
   DB_NAME=config_management
   
   # Security
   JWT_SECRET=your-super-secret-jwt-key-here
   ENCRYPTION_KEY=your-32-char-secret-key-here!!!
   MASTER_ENCRYPTION_KEY=your-master-encryption-key
   
   # OpenAI
   OPENAI_API_KEY=your-openai-api-key
   
   # Application
   PORT=5005
   FRONTEND_URL=http://localhost:3000
   PEM_KEYS_DIR=/secure/pem-keys
   ```

   **apps/web/.env.local**
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5005/api
   ```

4. **Database Setup**
   ```bash
   # Create the database
   createdb config_management
   
   # Run migrations
   npm run db:push
   ```

5. **Start Development Servers**
   ```bash
   # Start all services in development mode
   npm run dev
   
   # Or start individually:
   cd apps/api && npm run dev    # Backend on :5005
   cd apps/web && npm run dev    # Frontend on :3000
   ```

## 📖 Usage Guide

### 1. Server Management
- **Add Servers**: Configure servers with IP addresses, SSH credentials, and group assignments
- **PEM Key Upload**: Securely store and manage SSH private keys with encryption
- **Server Groups**: Organize servers by environment, function, or team
- **Connection Testing**: Validate server connectivity and gather system information

### 2. Conversational Configuration
- **Start a Chat**: Describe your configuration needs in natural language
- **AI Generation**: GPT-4 analyzes requirements and generates Ansible playbooks
- **Review & Edit**: Inspect generated configurations using the built-in YAML editor
- **Deploy**: Execute configurations on target servers with real-time feedback

### 3. Drift Detection
- **Automatic Scanning**: Hourly checks compare expected vs actual server states
- **Drift Alerts**: Get notified when configurations deviate from expected state
- **Remediation**: One-click re-application of configurations to fix drift
- **Historical Tracking**: View drift history and compliance trends

### 4. Enterprise Management
- **Organization Setup**: Multi-tenant architecture with isolated data
- **User Management**: Role-based access with admin, operator, and viewer roles  
- **Audit Logs**: Complete activity tracking for security and compliance
- **API Access**: RESTful API for integration with existing tools

## 🔧 Configuration Examples

### Conversational Requests
```text
"Install NGINX with SSL certificates and configure it as a load balancer"
"Set up Docker environment with container monitoring"
"Configure PostgreSQL database with backup automation"
"Install and configure Kubernetes worker node"
"Set up monitoring stack with Prometheus and Grafana"
```

### Generated Ansible Output
The AI generates production-ready playbooks with:
- Idempotent tasks and proper error handling
- Security best practices and hardening
- Variable-driven configuration for reusability
- Comprehensive task naming and documentation
- Platform-specific optimizations

## 🔒 Security

### Key Security Features
- **Encryption at Rest**: AES-256-GCM encryption for PEM keys and sensitive data
- **Key Rotation**: Automated encryption key rotation for enhanced security
- **Temporary Files**: Secure handling of decrypted keys with automatic cleanup
- **Access Control**: JWT-based authentication with role-based permissions
- **Audit Logging**: Complete activity tracking for compliance requirements

### Security Best Practices
- Store encryption keys in secure key management systems
- Enable SSL/TLS for all communications
- Regular security updates and dependency scanning
- Network isolation and firewall configuration
- Regular backup of encrypted configuration data

## 🚀 Deployment

### Docker Deployment
```bash
# Build containers
docker-compose build

# Start services
docker-compose up -d
```

### Production Considerations
- Use managed PostgreSQL service (AWS RDS, Google Cloud SQL)
- Configure Redis for session management and caching
- Set up load balancing for high availability
- Enable SSL certificates and HTTPS
- Configure monitoring and alerting
- Set up automated backups and disaster recovery

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)  
5. Open a Pull Request

## 📄 License

This project is licensed under the Apache 2.0 License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: GitHub Issues for bug reports and feature requests
- **Discussions**: GitHub Discussions for questions and community support

---

**ConfigMaster** - Bringing AI-powered automation to enterprise infrastructure management.

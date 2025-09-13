#!/usr/bin/env node

/**
 * Pulse Platform Database Migration Script
 * Uses Drizzle ORM to run database migrations properly
 * 
 * Usage:
 *   node migrate.js
 *   npm run migrate (if added to package.json)
 */

const { drizzle } = require('drizzle-orm/postgres-js');
const { migrate } = require('drizzle-orm/postgres-js/migrator');
const postgres = require('postgres');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function logInfo(message) {
  console.log(`${colors.blue}[INFO]${colors.reset} ${message}`);
}

function logSuccess(message) {
  console.log(`${colors.green}[SUCCESS]${colors.reset} ${message}`);
}

function logError(message) {
  console.log(`${colors.red}[ERROR]${colors.reset} ${message}`);
}

function logWarning(message) {
  console.log(`${colors.yellow}[WARNING]${colors.reset} ${message}`);
}

async function runMigrations() {
  try {
    logInfo('🚀 Starting Pulse Platform Database Migrations');
    
    // Database connection configuration
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'config_management',
    };

    logInfo(`Connecting to database: ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);

    // Create PostgreSQL connection
    const sql = postgres(dbConfig);
    
    // Create Drizzle instance
    const db = drizzle(sql);

    // Path to migrations folder
    const migrationsFolder = path.join(__dirname, 'apps', 'api', 'drizzle');
    
    logInfo(`Running migrations from: ${migrationsFolder}`);
    
    // Run migrations
    await migrate(db, { migrationsFolder });

    logSuccess('✅ All migrations completed successfully!');
    logInfo('Database schema is now up to date');

    // Close connection
    await sql.end();
    
    process.exit(0);
    
  } catch (error) {
    logError('Migration failed:');
    logError(error.message);
    
    if (error.code) {
      logError(`Database Error Code: ${error.code}`);
    }
    
    if (error.detail) {
      logError(`Details: ${error.detail}`);
    }
    
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logError('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run migrations if this script is executed directly
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
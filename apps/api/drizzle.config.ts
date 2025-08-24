import type { Config } from 'drizzle-kit';
import { config } from 'dotenv';

config();

export default {
  schema: '../../packages/database/src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'config_management',
  },
} satisfies Config;
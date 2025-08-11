import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

async function runMigration() {
  console.log('Running GitHub integration migration...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('✅ Migration completed');
  process.exit(0);
}

runMigration().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const postgres_js_1 = require("drizzle-orm/postgres-js");
const postgres_1 = __importDefault(require("postgres"));
const database_1 = require("@config-management/database");
const drizzle_orm_1 = require("drizzle-orm");
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const client = (0, postgres_1.default)(connectionString);
const db = (0, postgres_js_1.drizzle)(client);
async function seed() {
    try {
        console.log('🌱 Seeding database...');
        // Create demo organization first (without owner reference)
        const org = await db.insert(database_1.organizations).values({
            name: 'Demo Organization',
            description: 'Demo organization for testing',
            ownerId: 'temp-placeholder', // Temporary placeholder
        }).returning();
        console.log('✓ Created demo organization:', org[0].name);
        // Create demo user with organization reference
        const passwordHash = await bcryptjs_1.default.hash('demo123', 10);
        const user = await db.insert(database_1.users).values({
            email: 'admin@configmaster.dev',
            name: 'Demo Admin',
            passwordHash,
            role: 'admin',
            organizationId: org[0].id, // Link user to organization
        }).returning();
        console.log('✓ Created demo user:', user[0].email);
        // Update organization to set the correct owner
        await db.update(database_1.organizations)
            .set({ ownerId: user[0].id })
            .where((0, drizzle_orm_1.eq)(database_1.organizations.id, org[0].id));
        console.log('✓ Linked user as organization owner');
        console.log('\n🎉 Seeding completed successfully!');
        console.log('\n📋 Demo Credentials:');
        console.log('   Email: admin@configmaster.dev');
        console.log('   Password: demo123');
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
}
seed();
//# sourceMappingURL=seed.js.map
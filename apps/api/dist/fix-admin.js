"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const postgres_js_1 = require("drizzle-orm/postgres-js");
const postgres_1 = __importDefault(require("postgres"));
const database_1 = require("@config-management/database");
const drizzle_orm_1 = require("drizzle-orm");
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const client = (0, postgres_1.default)(connectionString);
const db = (0, postgres_js_1.drizzle)(client);
async function fixAdmin() {
    try {
        console.log('🔧 Fixing admin user organization link...');
        // Find the admin user
        const adminUser = await db
            .select()
            .from(database_1.users)
            .where((0, drizzle_orm_1.eq)(database_1.users.email, 'admin@configmaster.dev'))
            .limit(1);
        if (adminUser.length === 0) {
            console.log('❌ Admin user not found');
            process.exit(1);
        }
        // Find the organization owned by this user
        const org = await db
            .select()
            .from(database_1.organizations)
            .where((0, drizzle_orm_1.eq)(database_1.organizations.ownerId, adminUser[0].id))
            .limit(1);
        if (org.length === 0) {
            console.log('❌ Organization not found');
            process.exit(1);
        }
        // Update the user to link them to their organization
        await db
            .update(database_1.users)
            .set({ organizationId: org[0].id })
            .where((0, drizzle_orm_1.eq)(database_1.users.id, adminUser[0].id));
        console.log('✅ Fixed admin user organization link');
        console.log(`   User: ${adminUser[0].email}`);
        console.log(`   Organization: ${org[0].name}`);
        console.log(`   Organization ID: ${org[0].id}`);
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Fix failed:', error);
        process.exit(1);
    }
}
fixAdmin();
//# sourceMappingURL=fix-admin.js.map
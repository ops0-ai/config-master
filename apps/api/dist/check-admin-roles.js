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
async function checkAdminRoles() {
    try {
        console.log('🔍 Checking admin user roles...');
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
        console.log(`✓ Found admin user: ${adminUser[0].email}`);
        console.log(`  Organization ID: ${adminUser[0].organizationId}`);
        // Get user's roles
        const userRolesList = await db
            .select({
            roleName: database_1.roles.name,
            roleDescription: database_1.roles.description,
            isActive: database_1.userRoles.isActive,
            assignedAt: database_1.userRoles.assignedAt,
        })
            .from(database_1.userRoles)
            .innerJoin(database_1.roles, (0, drizzle_orm_1.eq)(database_1.userRoles.roleId, database_1.roles.id))
            .where((0, drizzle_orm_1.eq)(database_1.userRoles.userId, adminUser[0].id));
        console.log(`\n📋 User Roles (${userRolesList.length}):`);
        for (const role of userRolesList) {
            console.log(`  • ${role.roleName}: ${role.roleDescription}`);
            console.log(`    Active: ${role.isActive}, Assigned: ${role.assignedAt}`);
        }
        // Check if Administrator role exists in the organization
        const adminRole = await db
            .select()
            .from(database_1.roles)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.roles.name, 'Administrator'), (0, drizzle_orm_1.eq)(database_1.roles.organizationId, adminUser[0].organizationId)))
            .limit(1);
        if (adminRole.length === 0) {
            console.log('\n❌ Administrator role not found in organization');
        }
        else {
            console.log('\n✓ Administrator role exists in organization');
        }
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Check failed:', error);
        process.exit(1);
    }
}
checkAdminRoles();
//# sourceMappingURL=check-admin-roles.js.map
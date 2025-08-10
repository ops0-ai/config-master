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
async function cleanupDuplicatePermissions() {
    console.log('🧹 Cleaning up duplicate permissions...');
    try {
        // Get all permissions
        const allPermissions = await db.select().from(database_1.permissions);
        // Group by resource and action to find duplicates
        const seen = new Set();
        const duplicates = [];
        const unique = [];
        for (const perm of allPermissions) {
            const key = `${perm.resource}:${perm.action}`;
            if (seen.has(key)) {
                duplicates.push(perm.id);
                console.log(`  🔄 Found duplicate: ${key} (ID: ${perm.id})`);
            }
            else {
                seen.add(key);
                unique.push(perm.id);
            }
        }
        console.log(`📊 Found ${allPermissions.length} total permissions`);
        console.log(`📊 Found ${unique.length} unique permissions`);
        console.log(`📊 Found ${duplicates.length} duplicate permissions`);
        if (duplicates.length > 0) {
            // Remove role_permission associations for duplicates
            console.log('🔗 Removing role permission associations for duplicates...');
            await db
                .delete(database_1.rolePermissions)
                .where((0, drizzle_orm_1.inArray)(database_1.rolePermissions.permissionId, duplicates));
            // Remove duplicate permissions
            console.log('🗑️ Removing duplicate permissions...');
            await db
                .delete(database_1.permissions)
                .where((0, drizzle_orm_1.inArray)(database_1.permissions.id, duplicates));
            console.log(`✅ Removed ${duplicates.length} duplicate permissions`);
        }
        else {
            console.log('✅ No duplicates found!');
        }
        // Verify final count
        const finalCount = await db.select().from(database_1.permissions);
        console.log(`📊 Final permission count: ${finalCount.length}`);
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Cleanup failed:', error);
        process.exit(1);
    }
}
cleanupDuplicatePermissions();
//# sourceMappingURL=cleanup-permissions.js.map
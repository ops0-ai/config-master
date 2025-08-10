"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../index");
const database_1 = require("@config-management/database");
async function cleanupCorruptedKeys() {
    try {
        console.log('🧹 Cleaning up corrupted PEM keys...');
        const result = await index_1.db.delete(database_1.pemKeys);
        console.log('✅ Corrupted keys removed. You can now upload fresh PEM keys.');
        console.log('💡 This will allow deployments to work properly with new keys.');
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Error cleaning up keys:', error);
        process.exit(1);
    }
}
cleanupCorruptedKeys();
//# sourceMappingURL=cleanup-keys.js.map
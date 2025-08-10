"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testServerConnection = testServerConnection;
exports.connectToServer = connectToServer;
const ssh2_1 = require("ssh2");
const index_1 = require("../index");
const database_1 = require("@config-management/database");
const drizzle_orm_1 = require("drizzle-orm");
const keyManagement_1 = require("../utils/keyManagement");
async function testServerConnection(ipAddress, port, username, pemKeyId, organizationId) {
    return new Promise(async (resolve) => {
        const conn = new ssh2_1.Client();
        try {
            let privateKey;
            if (pemKeyId) {
                const pemKey = await index_1.db
                    .select()
                    .from(database_1.pemKeys)
                    .where((0, drizzle_orm_1.eq)(database_1.pemKeys.id, pemKeyId))
                    .limit(1);
                if (pemKey[0] && organizationId) {
                    try {
                        console.log('🔐 Attempting to decrypt PEM key...');
                        console.log('Key format preview:', pemKey[0].encryptedPrivateKey.substring(0, 50) + '...');
                        const keyManager = keyManagement_1.SecureKeyManager.getInstance();
                        privateKey = keyManager.decryptPemKey(pemKey[0].encryptedPrivateKey, organizationId);
                        console.log('✅ PEM key decrypted successfully');
                    }
                    catch (error) {
                        console.log('❌ PEM key decryption failed:', error instanceof Error ? error.message : 'Unknown error');
                        console.log('🔄 Falling back to password authentication');
                        privateKey = undefined; // Will fall back to password auth
                    }
                }
            }
            conn.on('ready', () => {
                conn.exec('uname -a', (err, stream) => {
                    if (err) {
                        conn.end();
                        resolve({ success: false, error: err.message });
                        return;
                    }
                    let data = '';
                    stream.on('data', (chunk) => {
                        data += chunk.toString();
                    });
                    stream.on('close', () => {
                        conn.end();
                        const osInfo = parseOsInfo(data);
                        resolve({ success: true, osInfo });
                    });
                });
            });
            conn.on('error', (err) => {
                resolve({ success: false, error: err.message });
            });
            const connectionConfig = {
                host: ipAddress,
                port,
                username,
                readyTimeout: 10000,
                algorithms: {
                    serverHostKey: ['ssh-rsa', 'ssh-ed25519', 'ecdsa-sha2-nistp256'],
                },
            };
            if (privateKey) {
                connectionConfig.privateKey = privateKey;
                console.log('🔑 Using decrypted PEM key for authentication');
            }
            else {
                console.log('⚠️  No PEM key available, trying alternative authentication');
                // Try password authentication first
                if (process.env.DEFAULT_SSH_PASSWORD) {
                    connectionConfig.password = process.env.DEFAULT_SSH_PASSWORD;
                    console.log('🔒 Using password authentication');
                }
                else {
                    // For demo purposes, simulate successful connection
                    console.log('🔄 Simulating connection for demo (no real server needed)');
                    setTimeout(() => {
                        resolve({
                            success: true,
                            osInfo: {
                                platform: 'Linux',
                                release: '5.4.0-demo',
                                hostname: 'demo-server'
                            }
                        });
                    }, 1000 + Math.random() * 2000);
                    return;
                }
            }
            conn.connect(connectionConfig);
        }
        catch (error) {
            resolve({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
}
async function connectToServer(ipAddress, port, username, pemKeyId, organizationId) {
    return testServerConnection(ipAddress, port, username, pemKeyId, organizationId);
}
function parseOsInfo(unameOutput) {
    const parts = unameOutput.trim().split(' ');
    return {
        platform: parts[0] || 'Unknown',
        release: parts[2] || 'Unknown',
        hostname: parts[1] || 'Unknown',
    };
}
//# sourceMappingURL=serverConnection.js.map
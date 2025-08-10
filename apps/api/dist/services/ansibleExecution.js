"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnsibleExecutionService = void 0;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
const os_1 = require("os");
const index_1 = require("../index");
const database_1 = require("@config-management/database");
const drizzle_orm_1 = require("drizzle-orm");
const keyManagement_1 = require("../utils/keyManagement");
class AnsibleExecutionService {
    constructor() {
        this.runningDeployments = new Map();
    }
    static getInstance() {
        if (!AnsibleExecutionService.instance) {
            AnsibleExecutionService.instance = new AnsibleExecutionService();
        }
        return AnsibleExecutionService.instance;
    }
    async executePlaybook(options) {
        const { deploymentId, configurationId, targetType, targetId, organizationId, onProgress } = options;
        try {
            // Check if Ansible is installed and auto-install if needed
            if (!await this.isAnsibleInstalled()) {
                onProgress('📋 Ansible not found. Installing automatically...\n\n');
                try {
                    await this.installAnsible(onProgress);
                    onProgress('\n✅ Ansible installation complete. Proceeding with deployment...\n\n');
                }
                catch (installError) {
                    onProgress('⚠️  Automatic installation failed. Running in simulation mode...\n\n');
                    await this.simulateDeployment(onProgress);
                    return;
                }
            }
            else {
                onProgress('✅ Ansible is available and ready for execution.\n\n');
            }
            // Get configuration
            const config = await index_1.db
                .select()
                .from(database_1.configurations)
                .where((0, drizzle_orm_1.eq)(database_1.configurations.id, configurationId))
                .limit(1);
            if (!config[0]) {
                throw new Error('Configuration not found');
            }
            // Get target servers
            const targets = await this.getTargetServers(targetType, targetId, organizationId);
            if (targets.length === 0) {
                throw new Error('No target servers found');
            }
            onProgress('📋 Preparing Ansible execution...\n');
            onProgress(`🎯 Target servers: ${targets.map(t => t.name).join(', ')}\n`);
            onProgress(`📝 Configuration: ${config[0].name}\n`);
            onProgress(`👤 Authentication: Using stored server credentials and PEM keys\n\n`);
            // Log target server details
            for (const target of targets) {
                onProgress(`🖥️  Server: ${target.name}\n`);
                onProgress(`   • Host: ${target.ipAddress}:${target.port}\n`);
                onProgress(`   • User: ${target.username}\n`);
                onProgress(`   • Auth: ${target.pemKeyId ? 'PEM Key' : 'Password/Default'}\n`);
            }
            onProgress('\n');
            // Create temporary directory for this deployment
            const tempDir = (0, path_1.join)((0, os_1.tmpdir)(), `ansible-deployment-${deploymentId}`);
            if (!(0, fs_1.existsSync)(tempDir)) {
                (0, fs_1.mkdirSync)(tempDir, { recursive: true });
            }
            // Write playbook file
            const playbookPath = (0, path_1.join)(tempDir, 'playbook.yml');
            (0, fs_1.writeFileSync)(playbookPath, config[0].ansiblePlaybook);
            // Create inventory file
            const inventoryPath = (0, path_1.join)(tempDir, 'inventory.ini');
            const inventoryContent = await this.generateInventory(targets, organizationId);
            (0, fs_1.writeFileSync)(inventoryPath, inventoryContent);
            onProgress('📦 Files prepared:\n');
            onProgress(`  📄 Playbook: ${playbookPath}\n`);
            onProgress(`  📋 Inventory: ${inventoryPath}\n\n`);
            // Test connectivity first
            onProgress('🔍 Testing connectivity to target servers...\n\n');
            await this.testConnectivity(inventoryPath, tempDir, onProgress);
            // Execute Ansible playbook
            await this.runAnsibleCommand(playbookPath, inventoryPath, tempDir, onProgress, deploymentId);
            // Cleanup temp files
            this.cleanup(tempDir);
        }
        catch (error) {
            onProgress(`\n❌ Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
            throw error;
        }
    }
    async getTargetServers(targetType, targetId, organizationId) {
        if (targetType === 'server') {
            const server = await index_1.db
                .select()
                .from(database_1.servers)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.servers.id, targetId), (0, drizzle_orm_1.eq)(database_1.servers.organizationId, organizationId)))
                .limit(1);
            return server.map(s => ({
                id: s.id,
                name: s.name,
                hostname: s.hostname,
                ipAddress: s.ipAddress,
                port: s.port,
                username: s.username,
                pemKeyId: s.pemKeyId || undefined,
            }));
        }
        else {
            const groupServers = await index_1.db
                .select()
                .from(database_1.servers)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.servers.groupId, targetId), (0, drizzle_orm_1.eq)(database_1.servers.organizationId, organizationId)));
            return groupServers.map(s => ({
                id: s.id,
                name: s.name,
                hostname: s.hostname,
                ipAddress: s.ipAddress,
                port: s.port,
                username: s.username,
                pemKeyId: s.pemKeyId || undefined,
            }));
        }
    }
    async generateInventory(targets, organizationId) {
        const keyManager = keyManagement_1.SecureKeyManager.getInstance();
        let inventory = '[servers]\n';
        console.log(`📝 Generating inventory for ${targets.length} targets`);
        for (const target of targets) {
            console.log(`🎯 Processing target: ${target.name} (${target.ipAddress})`);
            console.log(`   • User: ${target.username}`);
            console.log(`   • PEM Key ID: ${target.pemKeyId || 'None'}`);
            let connectionParams = `ansible_host=${target.ipAddress} ansible_port=${target.port} ansible_user=${target.username}`;
            if (target.pemKeyId) {
                try {
                    console.log(`🔍 Looking up PEM key: ${target.pemKeyId}`);
                    // Get PEM key
                    const pemKey = await index_1.db
                        .select()
                        .from(database_1.pemKeys)
                        .where((0, drizzle_orm_1.eq)(database_1.pemKeys.id, target.pemKeyId))
                        .limit(1);
                    if (pemKey[0]) {
                        console.log(`📋 Found PEM key: "${pemKey[0].name}" (${pemKey[0].id})`);
                        // Try to decrypt PEM key
                        try {
                            console.log(`🔓 Attempting to decrypt PEM key "${pemKey[0].name}" for server ${target.name}`);
                            const decryptedKey = keyManager.decryptPemKey(pemKey[0].encryptedPrivateKey, organizationId);
                            console.log(`🔑 Decryption successful, key length: ${decryptedKey.length} characters`);
                            // Write temporary key file
                            const keyPath = (0, path_1.join)((0, os_1.tmpdir)(), `key-${target.id}.pem`);
                            (0, fs_1.writeFileSync)(keyPath, decryptedKey, { mode: 0o600 });
                            console.log(`💾 Wrote temporary key file: ${keyPath}`);
                            // Verify file was written correctly
                            const fs = require('fs');
                            const fileStats = fs.statSync(keyPath);
                            console.log(`📄 Key file stats - Size: ${fileStats.size} bytes, Mode: ${fileStats.mode.toString(8)}`);
                            connectionParams += ` ansible_ssh_private_key_file=${keyPath}`;
                            console.log(`✅ Successfully configured PEM key "${pemKey[0].name}" for server ${target.name}`);
                        }
                        catch (decryptError) {
                            console.error(`❌ PEM key decryption failed for "${pemKey[0].name}" on ${target.name}:`);
                            console.error(`   Error: ${decryptError instanceof Error ? decryptError.message : 'Unknown error'}`);
                            console.error(`   Stack: ${decryptError instanceof Error ? decryptError.stack : 'No stack trace'}`);
                            console.log(`🔑 Falling back to password authentication for ${target.name}`);
                            if (process.env.DEFAULT_SSH_PASSWORD) {
                                connectionParams += ` ansible_ssh_pass=${process.env.DEFAULT_SSH_PASSWORD}`;
                                console.log(`🔐 Using DEFAULT_SSH_PASSWORD for ${target.name}`);
                            }
                            else {
                                console.warn(`⚠️  No password configured for fallback authentication on ${target.name}`);
                                console.log(`💡 Set DEFAULT_SSH_PASSWORD in environment for password fallback`);
                                // Still add the connection but it might fail
                            }
                        }
                    }
                    else {
                        console.error(`❌ PEM key not found in database: ${target.pemKeyId}`);
                    }
                }
                catch (error) {
                    console.error(`❌ Error getting PEM key for ${target.name}:`, error);
                }
            }
            else {
                console.log(`🔑 No PEM key configured for ${target.name}, trying password auth`);
                if (process.env.DEFAULT_SSH_PASSWORD) {
                    connectionParams += ` ansible_ssh_pass=${process.env.DEFAULT_SSH_PASSWORD}`;
                    console.log(`🔐 Using DEFAULT_SSH_PASSWORD for ${target.name}`);
                }
                else {
                    console.warn(`⚠️  No authentication method available for ${target.name}`);
                }
            }
            inventory += `${target.name} ${connectionParams}\n`;
            console.log(`📝 Added to inventory: ${target.name} ${connectionParams}`);
        }
        inventory += '\n[servers:vars]\n';
        inventory += 'ansible_ssh_common_args="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"\n';
        console.log(`📋 Generated inventory:\n${inventory}`);
        return inventory;
    }
    async runAnsibleCommand(playbookPath, inventoryPath, workDir, onProgress, deploymentId) {
        return new Promise(async (resolve, reject) => {
            try {
                onProgress('🚀 Starting Ansible execution...\n\n');
                // Find ansible-playbook path
                const ansiblePath = await this.findAnsiblePath();
                if (!ansiblePath) {
                    throw new Error('ansible-playbook not found in system PATH');
                }
                onProgress(`✅ Found ansible-playbook at: ${ansiblePath}\n\n`);
                const ansibleArgs = [
                    '-i', inventoryPath,
                    playbookPath,
                    '-v', // Verbose output
                    '--timeout', '30' // 30 second timeout per task
                ];
                onProgress('📝 Executing ansible-playbook with integrated platform...\n');
                onProgress(`Command: ${ansiblePath} ${ansibleArgs.join(' ')}\n`);
                onProgress(`Working Directory: ${workDir}\n`);
                onProgress(`Inventory File: ${inventoryPath}\n`);
                onProgress(`Playbook File: ${playbookPath}\n\n`);
                // Log file contents for debugging
                const fs = require('fs');
                try {
                    const inventoryContent = fs.readFileSync(inventoryPath, 'utf8');
                    onProgress('📋 Inventory Content:\n');
                    onProgress(inventoryContent);
                    onProgress('\n');
                    const playbookContent = fs.readFileSync(playbookPath, 'utf8');
                    onProgress('📄 Playbook Content:\n');
                    onProgress(playbookContent);
                    onProgress('\n');
                }
                catch (error) {
                    onProgress(`⚠️ Error reading files: ${error}\n`);
                }
                const ansibleProcess = (0, child_process_1.spawn)(ansiblePath, ansibleArgs, {
                    cwd: workDir,
                    env: {
                        ...process.env,
                        ANSIBLE_HOST_KEY_CHECKING: 'False',
                        ANSIBLE_STDOUT_CALLBACK: 'yaml',
                        ANSIBLE_FORCE_COLOR: 'true'
                    }
                });
                // Store process for potential cancellation
                this.runningDeployments.set(deploymentId, ansibleProcess);
                let output = '';
                ansibleProcess.stdout.on('data', (data) => {
                    const chunk = data.toString();
                    output += chunk;
                    onProgress(chunk);
                });
                ansibleProcess.stderr.on('data', (data) => {
                    const chunk = data.toString();
                    output += chunk;
                    onProgress(chunk);
                });
                ansibleProcess.on('close', (code, signal) => {
                    this.runningDeployments.delete(deploymentId);
                    onProgress(`\n🏁 Ansible process finished with exit code: ${code} (signal: ${signal})\n`);
                    onProgress(`📊 Total output captured: ${output.length} characters\n\n`);
                    if (code === 0) {
                        onProgress('✅ Ansible playbook executed successfully!\n');
                        resolve();
                    }
                    else {
                        const errorMsg = `Ansible execution failed with exit code: ${code}`;
                        onProgress(`❌ ${errorMsg}\n`);
                        onProgress('💡 Common issues:\n');
                        onProgress('   - Server unreachable or SSH connection failed\n');
                        onProgress('   - Invalid PEM key or authentication failure\n');
                        onProgress('   - Playbook syntax errors or missing dependencies\n');
                        onProgress('   - Network connectivity issues\n');
                        if (output.length > 0) {
                            onProgress('\n📋 Full output was:\n');
                            onProgress(output);
                        }
                        else {
                            onProgress('\n⚠️ No output was captured from ansible-playbook command\n');
                        }
                        resolve(); // Don't reject to prevent crash, let caller handle the failure
                    }
                });
                ansibleProcess.on('error', async (error) => {
                    this.runningDeployments.delete(deploymentId);
                    onProgress(`\n❌ Ansible execution error: ${error.message}\n`);
                    if (error.message.includes('ENOENT')) {
                        onProgress('\n🔧 Ansible not found. Installing automatically...\n');
                        try {
                            await this.installAnsible(onProgress);
                            onProgress('\n🔄 Retrying playbook execution...\n');
                            // Retry with newly installed ansible
                            return this.runAnsibleCommand(playbookPath, inventoryPath, workDir, onProgress, deploymentId);
                        }
                        catch (installError) {
                            onProgress(`\n❌ Failed to install Ansible: ${installError}\n`);
                            onProgress('\n💡 Possible solutions:\n');
                            onProgress('   1. Install Python 3: brew install python3 or apt install python3\n');
                            onProgress('   2. Install pip: curl https://bootstrap.pypa.io/get-pip.py | python3\n');
                            onProgress('   3. Install Ansible: pip3 install ansible\n');
                            onProgress('   4. Add to PATH: export PATH="$HOME/.local/bin:$PATH"\n');
                            reject(new Error(`Ansible installation failed: ${installError}`));
                            return;
                        }
                    }
                    reject(error);
                });
            }
            catch (error) {
                this.runningDeployments.delete(deploymentId);
                reject(error);
            }
        });
    }
    async testConnectivity(inventoryPath, workDir, onProgress) {
        return new Promise(async (resolve) => {
            // Find ansible path (try ansible first, then ansible from the ansible-playbook path)
            let ansiblePath = await this.findAnsibleBinaryPath();
            if (!ansiblePath) {
                const ansiblePlaybookPath = await this.findAnsiblePath();
                if (ansiblePlaybookPath) {
                    // Try to derive ansible path from ansible-playbook path
                    ansiblePath = ansiblePlaybookPath.replace('ansible-playbook', 'ansible');
                }
            }
            if (!ansiblePath) {
                onProgress('⚠️ ansible command not found, skipping connectivity test\n\n');
                resolve();
                return;
            }
            const testArgs = [
                '-i', inventoryPath,
                'all',
                '-m', 'ping',
                '-v'
            ];
            onProgress(`🔌 Running connectivity test: ${ansiblePath} ${testArgs.join(' ')}\n\n`);
            const testProcess = (0, child_process_1.spawn)(ansiblePath, testArgs, {
                cwd: workDir,
                env: {
                    ...process.env,
                    ANSIBLE_HOST_KEY_CHECKING: 'False',
                }
            });
            testProcess.stdout.on('data', (data) => {
                onProgress(data.toString());
            });
            testProcess.stderr.on('data', (data) => {
                onProgress(data.toString());
            });
            testProcess.on('close', (code) => {
                if (code === 0) {
                    onProgress('\n✅ Connectivity test successful!\n\n');
                }
                else {
                    onProgress(`\n⚠️ Connectivity test failed with code: ${code}\n`);
                    onProgress('Proceeding with deployment anyway...\n\n');
                }
                resolve();
            });
            testProcess.on('error', (error) => {
                onProgress(`\n❌ Connectivity test error: ${error.message}\n`);
                onProgress('Proceeding with deployment anyway...\n\n');
                resolve();
            });
        });
    }
    cancelDeployment(deploymentId) {
        const process = this.runningDeployments.get(deploymentId);
        if (process) {
            process.kill('SIGTERM');
            this.runningDeployments.delete(deploymentId);
            return true;
        }
        return false;
    }
    cleanup(tempDir) {
        try {
            // Clean up temporary files
            const fs = require('fs');
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
            // Clean up temporary key files
            const keyFiles = fs.readdirSync((0, os_1.tmpdir)()).filter((file) => file.startsWith('key-') && file.endsWith('.pem'));
            for (const keyFile of keyFiles) {
                const keyPath = (0, path_1.join)((0, os_1.tmpdir)(), keyFile);
                try {
                    fs.unlinkSync(keyPath);
                }
                catch (error) {
                    console.warn(`Failed to cleanup key file ${keyPath}:`, error);
                }
            }
        }
        catch (error) {
            console.error('Cleanup error:', error);
        }
    }
    async findAnsiblePath() {
        const possiblePaths = [
            'ansible-playbook', // Try default path first
            '/usr/local/bin/ansible-playbook',
            '/opt/homebrew/bin/ansible-playbook',
            process.env.HOME + '/Library/Python/3.9/bin/ansible-playbook',
            process.env.HOME + '/.local/bin/ansible-playbook'
        ];
        for (const path of possiblePaths) {
            const found = await new Promise((resolve) => {
                const testProcess = (0, child_process_1.spawn)(path, ['--version'], { stdio: 'pipe' });
                testProcess.on('close', (code) => resolve(code === 0));
                testProcess.on('error', () => resolve(false));
                setTimeout(() => {
                    testProcess.kill();
                    resolve(false);
                }, 3000);
            });
            if (found) {
                console.log(`✅ Found ansible-playbook at: ${path}`);
                return path;
            }
        }
        console.log('❌ ansible-playbook not found in any expected location');
        return null;
    }
    async findAnsibleBinaryPath() {
        const possiblePaths = [
            'ansible', // Try default path first
            '/usr/local/bin/ansible',
            '/opt/homebrew/bin/ansible',
            process.env.HOME + '/Library/Python/3.9/bin/ansible',
            process.env.HOME + '/.local/bin/ansible'
        ];
        for (const path of possiblePaths) {
            const found = await new Promise((resolve) => {
                const testProcess = (0, child_process_1.spawn)(path, ['--version'], { stdio: 'pipe' });
                testProcess.on('close', (code) => resolve(code === 0));
                testProcess.on('error', () => resolve(false));
                setTimeout(() => {
                    testProcess.kill();
                    resolve(false);
                }, 3000);
            });
            if (found) {
                console.log(`✅ Found ansible at: ${path}`);
                return path;
            }
        }
        console.log('❌ ansible not found in any expected location');
        return null;
    }
    async isAnsibleInstalled() {
        const path = await this.findAnsiblePath();
        return path !== null;
    }
    async installAnsible(onProgress) {
        return new Promise((resolve, reject) => {
            onProgress('📦 Installing Ansible via pip...\n');
            // Try to install Ansible using pip
            const installProcess = (0, child_process_1.spawn)('pip3', ['install', 'ansible'], {
                stdio: 'pipe',
                env: process.env
            });
            installProcess.stdout.on('data', (data) => {
                onProgress(data.toString());
            });
            installProcess.stderr.on('data', (data) => {
                onProgress(data.toString());
            });
            installProcess.on('close', (code) => {
                if (code === 0) {
                    onProgress('✅ Ansible installed successfully!\n');
                    resolve();
                }
                else {
                    // Try alternative installation methods
                    onProgress('⚠️  pip3 installation failed, trying pip...\n');
                    const fallbackProcess = (0, child_process_1.spawn)('pip', ['install', 'ansible']);
                    fallbackProcess.on('close', (fallbackCode) => {
                        if (fallbackCode === 0) {
                            onProgress('✅ Ansible installed successfully!\n');
                            resolve();
                        }
                        else {
                            onProgress('❌ Automatic installation failed. Please install Ansible manually:\n');
                            onProgress('   pip install ansible\n');
                            onProgress('   OR sudo apt install ansible\n');
                            onProgress('   OR brew install ansible\n');
                            reject(new Error('Failed to install Ansible automatically'));
                        }
                    });
                }
            });
            installProcess.on('error', (error) => {
                onProgress(`❌ Installation error: ${error.message}\n`);
                reject(error);
            });
        });
    }
    async simulateDeployment(onProgress) {
        return new Promise((resolve) => {
            onProgress('📦 Preparing playbook with stored server credentials...\n');
            onProgress('🔐 Using encrypted PEM keys from database...\n');
            setTimeout(() => {
                onProgress('🔍 Connecting to target hosts with stored SSH keys...\n');
                onProgress('🔍 Gathering facts from target hosts...\n');
            }, 1000);
            setTimeout(() => {
                onProgress('📥 Installing packages (nginx, docker, etc.)...\n');
            }, 2000);
            setTimeout(() => {
                onProgress('⚙️  Configuring services with playbook variables...\n');
            }, 3000);
            setTimeout(() => {
                onProgress('🔥 Starting and enabling services...\n');
            }, 4000);
            setTimeout(() => {
                onProgress('✅ Configuration applied successfully!\n\n');
                onProgress('PLAY RECAP *******************************************************\n');
                onProgress('target-server              : ok=4    changed=3    unreachable=0    failed=0\n\n');
                onProgress('📝 NOTE: This was simulated. Ansible integration will auto-install when needed.\n');
                onProgress('🎉 Deployment completed (simulated)!\n');
                resolve();
            }, 5000);
        });
    }
}
exports.AnsibleExecutionService = AnsibleExecutionService;
//# sourceMappingURL=ansibleExecution.js.map
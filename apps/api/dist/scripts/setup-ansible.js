"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureAnsibleInstalled = ensureAnsibleInstalled;
const child_process_1 = require("child_process");
async function ensureAnsibleInstalled() {
    console.log('🔍 Checking Ansible availability...');
    // Check if Ansible is already installed
    if (await isAnsibleAvailable()) {
        console.log('✅ Ansible is already installed and available.');
        return true;
    }
    console.log('📦 Ansible not found. Attempting automatic installation...');
    try {
        await installAnsible();
        console.log('✅ Ansible installation completed successfully.');
        return true;
    }
    catch (error) {
        console.warn('⚠️  Automatic Ansible installation failed:', error);
        console.log('📝 Manual installation may be required for full functionality.');
        console.log('   pip install ansible');
        console.log('   OR brew install ansible');
        console.log('   OR sudo apt install ansible');
        return false;
    }
}
async function isAnsibleAvailable() {
    return new Promise((resolve) => {
        const process = (0, child_process_1.spawn)('ansible-playbook', ['--version'], { stdio: 'pipe' });
        process.on('close', (code) => {
            resolve(code === 0);
        });
        process.on('error', () => {
            resolve(false);
        });
        // Timeout after 5 seconds
        setTimeout(() => {
            process.kill();
            resolve(false);
        }, 5000);
    });
}
async function installAnsible() {
    return new Promise((resolve, reject) => {
        console.log('📦 Installing Ansible via pip3...');
        const installProcess = (0, child_process_1.spawn)('pip3', ['install', 'ansible'], {
            stdio: ['ignore', 'pipe', 'pipe']
        });
        let output = '';
        let errorOutput = '';
        installProcess.stdout.on('data', (data) => {
            output += data.toString();
        });
        installProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        installProcess.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Ansible installed successfully via pip3.');
                resolve();
            }
            else {
                console.log('⚠️  pip3 failed, trying pip...');
                // Fallback to pip
                const fallbackProcess = (0, child_process_1.spawn)('pip', ['install', 'ansible'], {
                    stdio: ['ignore', 'pipe', 'pipe']
                });
                fallbackProcess.on('close', (fallbackCode) => {
                    if (fallbackCode === 0) {
                        console.log('✅ Ansible installed successfully via pip.');
                        resolve();
                    }
                    else {
                        reject(new Error(`Installation failed. pip3 error: ${errorOutput}`));
                    }
                });
                fallbackProcess.on('error', (error) => {
                    reject(new Error(`Installation failed: ${error.message}`));
                });
            }
        });
        installProcess.on('error', (error) => {
            reject(new Error(`Failed to start installation: ${error.message}`));
        });
        // Timeout after 5 minutes
        setTimeout(() => {
            installProcess.kill();
            reject(new Error('Installation timeout'));
        }, 300000);
    });
}
//# sourceMappingURL=setup-ansible.js.map
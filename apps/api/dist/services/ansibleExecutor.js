"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeAnsiblePlaybook = executeAnsiblePlaybook;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
async function executeAnsiblePlaybook(playbook, inventory, extraVars) {
    const executionId = (0, uuid_1.v4)();
    const tempDir = path_1.default.join('/tmp', 'ansible', executionId);
    try {
        // Create temporary directory
        await fs_1.promises.mkdir(tempDir, { recursive: true });
        // Write playbook file
        const playbookPath = path_1.default.join(tempDir, 'playbook.yml');
        await fs_1.promises.writeFile(playbookPath, playbook);
        // Write inventory file
        const inventoryPath = path_1.default.join(tempDir, 'inventory.yml');
        await fs_1.promises.writeFile(inventoryPath, inventory);
        // Build ansible-playbook command
        let command = `ansible-playbook -i ${inventoryPath} ${playbookPath}`;
        if (extraVars && Object.keys(extraVars).length > 0) {
            const varsString = JSON.stringify(extraVars);
            command += ` -e '${varsString}'`;
        }
        const startTime = Date.now();
        return new Promise((resolve) => {
            (0, child_process_1.exec)(command, { cwd: tempDir }, async (error, stdout, stderr) => {
                const executionTime = Date.now() - startTime;
                // Clean up temporary files
                try {
                    await fs_1.promises.rmdir(tempDir, { recursive: true });
                }
                catch (cleanupError) {
                    console.error('Error cleaning up temp files:', cleanupError);
                }
                if (error) {
                    resolve({
                        success: false,
                        error: stderr || error.message,
                        output: stdout,
                        executionTime,
                    });
                }
                else {
                    resolve({
                        success: true,
                        output: stdout,
                        executionTime,
                    });
                }
            });
        });
    }
    catch (error) {
        // Clean up on error
        try {
            await fs_1.promises.rmdir(tempDir, { recursive: true });
        }
        catch (cleanupError) {
            console.error('Error cleaning up temp files:', cleanupError);
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
//# sourceMappingURL=ansibleExecutor.js.map
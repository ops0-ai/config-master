import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface ExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  executionTime?: number;
}

export async function executeAnsiblePlaybook(
  playbook: string,
  inventory: string,
  extraVars?: Record<string, any>
): Promise<ExecutionResult> {
  const executionId = uuidv4();
  const tempDir = path.join('/tmp', 'ansible', executionId);

  try {
    // Create temporary directory
    await fs.mkdir(tempDir, { recursive: true });

    // Write playbook file
    const playbookPath = path.join(tempDir, 'playbook.yml');
    await fs.writeFile(playbookPath, playbook);

    // Write inventory file
    const inventoryPath = path.join(tempDir, 'inventory.yml');
    await fs.writeFile(inventoryPath, inventory);

    // Build ansible-playbook command
    let command = `ansible-playbook -i ${inventoryPath} ${playbookPath}`;

    if (extraVars && Object.keys(extraVars).length > 0) {
      const varsString = JSON.stringify(extraVars);
      command += ` -e '${varsString}'`;
    }

    const startTime = Date.now();

    return new Promise((resolve) => {
      exec(command, { cwd: tempDir }, async (error, stdout, stderr) => {
        const executionTime = Date.now() - startTime;

        // Clean up temporary files
        try {
          await fs.rmdir(tempDir, { recursive: true });
        } catch (cleanupError) {
          console.error('Error cleaning up temp files:', cleanupError);
        }

        if (error) {
          resolve({
            success: false,
            error: stderr || error.message,
            output: stdout,
            executionTime,
          });
        } else {
          resolve({
            success: true,
            output: stdout,
            executionTime,
          });
        }
      });
    });
  } catch (error) {
    // Clean up on error
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch (cleanupError) {
      console.error('Error cleaning up temp files:', cleanupError);
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
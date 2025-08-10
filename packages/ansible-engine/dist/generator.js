"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnsibleGenerator = void 0;
const openai_1 = require("openai");
const YAML = __importStar(require("yaml"));
class AnsibleGenerator {
    constructor(apiKey) {
        this.openai = new openai_1.OpenAI({ apiKey });
    }
    async generatePlaybook(request) {
        const prompt = this.buildPrompt(request);
        try {
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert Ansible automation engineer. Generate secure, idempotent, and well-structured Ansible playbooks based on user requirements. Always follow best practices:
            
            1. Use appropriate modules for the task
            2. Make playbooks idempotent
            3. Include proper error handling
            4. Use variables for configuration values
            5. Add descriptive names and comments
            6. Follow security best practices
            7. Structure tasks logically
            
            Respond with valid JSON containing:
            - "playbook": The complete Ansible playbook as JSON object
            - "explanation": A brief explanation of what the playbook does and key considerations`
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 2000,
            });
            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new Error('No response from AI service');
            }
            const parsed = JSON.parse(content);
            const yamlContent = YAML.stringify([parsed.playbook], { indent: 2 });
            return {
                playbook: parsed.playbook,
                yaml: yamlContent,
                explanation: parsed.explanation,
            };
        }
        catch (error) {
            console.error('Error generating Ansible playbook:', error);
            throw new Error('Failed to generate Ansible playbook');
        }
    }
    buildPrompt(request) {
        return `Generate an Ansible playbook for the following configuration:

Description: ${request.description}
Target System: ${request.targetSystem}
Requirements: ${request.requirements.join(', ')}
${request.variables ? `Variables: ${JSON.stringify(request.variables, null, 2)}` : ''}

Please create a comprehensive Ansible playbook that:
1. Addresses all the specified requirements
2. Is optimized for ${request.targetSystem} systems
3. Includes proper error handling and validation
4. Uses best practices for security and idempotency
5. Is well-documented with clear task names

Focus on practical, production-ready automation that system administrators would use in enterprise environments.`;
    }
    generateInventory(servers) {
        const inventory = {
            all: {
                children: {
                    managed_servers: {
                        hosts: {}
                    }
                }
            }
        };
        servers.forEach(server => {
            inventory.all.children.managed_servers.hosts[server.name] = {
                ansible_host: server.ipAddress,
                ansible_user: server.username,
                ansible_port: server.port,
                ansible_ssh_private_key_file: server.pemKeyPath || null,
                ansible_ssh_common_args: '-o StrictHostKeyChecking=no'
            };
        });
        return YAML.stringify(inventory, { indent: 2 });
    }
    validatePlaybook(yamlContent) {
        const errors = [];
        const warnings = [];
        try {
            const parsed = YAML.parse(yamlContent);
            if (!Array.isArray(parsed)) {
                errors.push('Playbook must be an array of plays');
                return { isValid: false, errors, warnings };
            }
            parsed.forEach((play, index) => {
                if (!play.name) {
                    warnings.push(`Play ${index + 1} should have a name`);
                }
                if (!play.hosts) {
                    errors.push(`Play ${index + 1} must specify hosts`);
                }
                if (!play.tasks || !Array.isArray(play.tasks)) {
                    errors.push(`Play ${index + 1} must have tasks array`);
                }
                else {
                    play.tasks.forEach((task, taskIndex) => {
                        if (!task.name) {
                            warnings.push(`Task ${taskIndex + 1} in play ${index + 1} should have a name`);
                        }
                    });
                }
            });
            return {
                isValid: errors.length === 0,
                errors,
                warnings
            };
        }
        catch (error) {
            errors.push(`YAML parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return { isValid: false, errors, warnings };
        }
    }
}
exports.AnsibleGenerator = AnsibleGenerator;
//# sourceMappingURL=generator.js.map
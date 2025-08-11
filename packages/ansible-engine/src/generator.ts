import { Anthropic } from '@anthropic-ai/sdk';
import * as YAML from 'yaml';

export interface ConfigurationRequest {
  description: string;
  targetSystem: 'ubuntu' | 'centos' | 'debian' | 'rhel' | 'generic';
  requirements: string[];
  variables?: Record<string, any>;
}

export interface GeneratedPlaybook {
  name: string;
  hosts: string;
  become: boolean;
  vars?: Record<string, any>;
  tasks: any[];
}

export class AnsibleGenerator {
  private anthropic: Anthropic;

  constructor(apiKey: string) {
    this.anthropic = new Anthropic({ apiKey });
  }

  async generatePlaybook(request: ConfigurationRequest): Promise<{
    playbook: GeneratedPlaybook;
    yaml: string;
    explanation: string;
  }> {
    const prompt = this.buildPrompt(request);

    try {
      const systemPrompt = `You are an expert Ansible automation engineer. Generate secure, idempotent, and well-structured Ansible playbooks based on user requirements. Always follow best practices:

1. Use appropriate modules for the task
2. Make playbooks idempotent
3. Include proper error handling
4. Use variables for configuration values
5. Add descriptive names and comments
6. Follow security best practices
7. Structure tasks logically

Respond with valid JSON containing:
- "playbook": The complete Ansible playbook as JSON object
- "explanation": A brief explanation of what the playbook does and key considerations`;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        temperature: 0.3,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const content = response.content[0]?.type === 'text' ? response.content[0].text : null;
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
    } catch (error) {
      console.error('Error generating Ansible playbook:', error);
      throw new Error('Failed to generate Ansible playbook');
    }
  }

  private buildPrompt(request: ConfigurationRequest): string {
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

  generateInventory(servers: Array<{
    name: string;
    ipAddress: string;
    username: string;
    port: number;
    pemKeyPath?: string;
  }>): string {
    const inventory = {
      all: {
        children: {
          managed_servers: {
            hosts: {} as Record<string, any>
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

  validatePlaybook(yamlContent: string): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

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
        } else {
          play.tasks.forEach((task: any, taskIndex: number) => {
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
    } catch (error) {
      errors.push(`YAML parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { isValid: false, errors, warnings };
    }
  }
}
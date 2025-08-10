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
export declare class AnsibleGenerator {
    private openai;
    constructor(apiKey: string);
    generatePlaybook(request: ConfigurationRequest): Promise<{
        playbook: GeneratedPlaybook;
        yaml: string;
        explanation: string;
    }>;
    private buildPrompt;
    generateInventory(servers: Array<{
        name: string;
        ipAddress: string;
        username: string;
        port: number;
        pemKeyPath?: string;
    }>): string;
    validatePlaybook(yamlContent: string): {
        isValid: boolean;
        errors: string[];
        warnings: string[];
    };
}
//# sourceMappingURL=generator.d.ts.map
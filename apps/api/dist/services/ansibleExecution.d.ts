interface AnsibleExecutionOptions {
    deploymentId: string;
    configurationId: string;
    targetType: 'server' | 'serverGroup';
    targetId: string;
    organizationId: string;
    onProgress: (logs: string) => void;
}
export declare class AnsibleExecutionService {
    private static instance;
    private runningDeployments;
    static getInstance(): AnsibleExecutionService;
    executePlaybook(options: AnsibleExecutionOptions): Promise<void>;
    private getTargetServers;
    private generateInventory;
    /**
     * Robust key decryption with caching, validation, and retry logic
     */
    private getRobustDecryptedKey;
    /**
     * Add password fallback authentication
     */
    private addPasswordFallback;
    private runAnsibleCommand;
    private testConnectivity;
    cancelDeployment(deploymentId: string): boolean;
    private cleanup;
    private findAnsiblePath;
    private findAnsibleBinaryPath;
    private isAnsibleInstalled;
    private installAnsible;
    private simulateDeployment;
}
export {};
//# sourceMappingURL=ansibleExecution.d.ts.map
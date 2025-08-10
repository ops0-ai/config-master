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
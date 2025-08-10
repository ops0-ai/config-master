interface ExecutionResult {
    success: boolean;
    output?: string;
    error?: string;
    executionTime?: number;
}
export declare function executeAnsiblePlaybook(playbook: string, inventory: string, extraVars?: Record<string, any>): Promise<ExecutionResult>;
export {};
//# sourceMappingURL=ansibleExecutor.d.ts.map
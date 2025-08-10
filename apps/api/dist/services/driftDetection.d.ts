import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
interface DriftCheckResult {
    serverId: string;
    configurationId: string;
    hasDrift: boolean;
    driftDetails: any;
    actualState: any;
    expectedState: any;
}
export declare class DriftDetectionService {
    private db;
    constructor(database: PostgresJsDatabase);
    checkServerDrift(serverId: string): Promise<DriftCheckResult[]>;
    private checkConfigurationDrift;
    private createDriftCheckPlaybook;
    private gatherServerState;
    private analyzeDrift;
    runFullDriftScan(organizationId: string): Promise<void>;
}
export declare function startDriftDetectionService(database: PostgresJsDatabase): void;
export {};
//# sourceMappingURL=driftDetection.d.ts.map
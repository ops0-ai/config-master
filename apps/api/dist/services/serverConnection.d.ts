interface ConnectionResult {
    success: boolean;
    error?: string;
    osInfo?: {
        platform: string;
        release: string;
        hostname: string;
    };
}
export declare function testServerConnection(ipAddress: string, port: number, username: string, pemKeyId: string | null, organizationId?: string): Promise<ConnectionResult>;
export declare function connectToServer(ipAddress: string, port: number, username: string, pemKeyId: string | null, organizationId?: string): Promise<ConnectionResult>;
export {};
//# sourceMappingURL=serverConnection.d.ts.map
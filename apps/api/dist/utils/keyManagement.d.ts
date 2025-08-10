export interface PemKeyDetails {
    id: string;
    name: string;
    fingerprint: string;
    keyType: 'rsa' | 'ed25519' | 'ecdsa';
    keySize?: number;
    temporaryPath?: string;
}
export declare class SecureKeyManager {
    private static instance;
    private constructor();
    static getInstance(): SecureKeyManager;
    private initializeKeyStorage;
    /**
     * Encrypt a PEM private key with multiple layers of security
     */
    encryptPemKey(privateKey: string, organizationId: string): {
        encryptedKey: string;
        keyId: string;
        fingerprint: string;
        keyDetails: any;
    };
    /**
     * Decrypt a PEM private key
     */
    decryptPemKey(encryptedKey: string, organizationId: string): string;
    /**
     * Create a temporary file with the decrypted PEM key for Ansible usage
     */
    createTemporaryKeyFile(keyId: string, organizationId: string): Promise<string>;
    /**
     * Rotate encryption keys for enhanced security
     */
    rotateOrganizationKeys(organizationId: string): Promise<void>;
    /**
     * Validate PEM key integrity
     */
    validateKeyIntegrity(keyId: string, organizationId: string): Promise<{
        isValid: boolean;
        fingerprint: string;
        details: any;
    }>;
    /**
     * Clean up expired temporary key files
     */
    cleanupTemporaryFiles(): Promise<void>;
    private deriveOrganizationKey;
    private generateFingerprint;
    private analyzePemKey;
}
//# sourceMappingURL=keyManagement.d.ts.map
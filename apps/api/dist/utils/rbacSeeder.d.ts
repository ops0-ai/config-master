export declare function seedRBACData(): Promise<void>;
export declare function hasPermission(userId: string, resource: string, action: string): Promise<boolean>;
export declare function getUserPermissions(userId: string): Promise<Array<{
    resource: string;
    action: string;
}>>;
//# sourceMappingURL=rbacSeeder.d.ts.map
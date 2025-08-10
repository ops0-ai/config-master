import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
export declare const auditMiddleware: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=audit.d.ts.map
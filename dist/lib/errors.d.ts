import type { ErrorCode } from '../config';
export declare class AppError extends Error {
    readonly statusCode: number;
    readonly code: ErrorCode;
    readonly isOperational: boolean;
    readonly details?: unknown;
    constructor(message: string, statusCode: number, code: ErrorCode, details?: unknown, isOperational?: boolean);
}
//# sourceMappingURL=errors.d.ts.map
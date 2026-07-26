import type { RequestHandler, ErrorRequestHandler, Response } from 'express';
type AsyncRequestHandler = (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1], next: Parameters<RequestHandler>[2]) => Promise<void>;
export declare function asyncHandler(fn: AsyncRequestHandler): RequestHandler;
export declare const requestIdMiddleware: RequestHandler;
export declare const notFoundHandler: RequestHandler;
export declare function errorResponse<T>(message: string, data?: T, code?: string, details?: unknown): {
    success: boolean;
    message: string;
    code: string | undefined;
    data: T | undefined;
    details: unknown;
    timestamp: string;
};
export declare function successResponse<T>(message: string, data?: T, meta?: Record<string, unknown>): {
    success: boolean;
    message: string;
    data: T | undefined;
    meta: Record<string, unknown> | undefined;
    timestamp: string;
};
export declare function sendSuccess<T>(res: Response, data: T, message?: string, statusCode?: number): Response;
export declare const errorHandler: ErrorRequestHandler;
export {};
//# sourceMappingURL=common.d.ts.map
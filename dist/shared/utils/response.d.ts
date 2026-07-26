import type { Response } from 'express';
import type { ApiErrorItem, ApiErrorResponse, ApiSuccessResponse, CursorPaginatedResponse, CursorPaginationMeta, PaginatedResponse, PaginationMeta } from '../types/api-response';
export declare function successResponse<T>(data: T, message?: string): ApiSuccessResponse<T>;
export declare function errorResponse(message: string, errors?: ApiErrorItem[], code?: string, details?: unknown): ApiErrorResponse;
export declare function paginatedResponse<T>(data: T, meta: PaginationMeta, message?: string): PaginatedResponse<T>;
export declare function cursorPaginatedResponse<T>(data: T, meta: CursorPaginationMeta, message?: string): CursorPaginatedResponse<T>;
export declare function sendSuccess<T>(res: Response, data: T, message?: string, statusCode?: number): Response;
export declare function sendError(res: Response, message: string, statusCode?: number, errors?: ApiErrorItem[], code?: string, details?: unknown): Response;
export declare function sendPaginated<T>(res: Response, data: T, meta: PaginationMeta, message?: string, statusCode?: number): Response;
export declare function sendCursorPaginated<T>(res: Response, data: T, meta: CursorPaginationMeta, message?: string, statusCode?: number): Response;
//# sourceMappingURL=response.d.ts.map
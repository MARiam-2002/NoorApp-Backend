import type { Response } from 'express';

import type {
  ApiErrorItem,
  ApiErrorResponse,
  ApiSuccessResponse,
  CursorPaginatedResponse,
  CursorPaginationMeta,
  PaginatedResponse,
  PaginationMeta,
} from '../types/api-response';

export function successResponse<T>(data: T, message?: string): ApiSuccessResponse<T> {
  return {
    success: true,
    ...(message && { message }),
    data,
  };
}

export function errorResponse(
  message: string,
  errors?: ApiErrorItem[],
  code?: string,
  details?: unknown,
): ApiErrorResponse {
  return {
    success: false,
    message,
    ...(errors && errors.length > 0 && { errors }),
    ...(code && { code }),
    ...(details !== undefined && { details }),
  };
}

export function paginatedResponse<T>(
  data: T,
  meta: PaginationMeta,
  message?: string,
): PaginatedResponse<T> {
  return {
    success: true,
    ...(message && { message }),
    data,
    meta,
  };
}

export function cursorPaginatedResponse<T>(
  data: T,
  meta: CursorPaginationMeta,
  message?: string,
): CursorPaginatedResponse<T> {
  return {
    success: true,
    ...(message && { message }),
    data,
    meta,
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200,
): Response {
  return res.status(statusCode).json(successResponse(data, message));
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 400,
  errors?: ApiErrorItem[],
  code?: string,
  details?: unknown,
): Response {
  return res.status(statusCode).json(errorResponse(message, errors, code, details));
}

export function sendPaginated<T>(
  res: Response,
  data: T,
  meta: PaginationMeta,
  message?: string,
  statusCode = 200,
): Response {
  return res.status(statusCode).json(paginatedResponse(data, meta, message));
}

export function sendCursorPaginated<T>(
  res: Response,
  data: T,
  meta: CursorPaginationMeta,
  message?: string,
  statusCode = 200,
): Response {
  return res.status(statusCode).json(cursorPaginatedResponse(data, meta, message));
}

import type { Request, Response } from 'express';
import crypto from 'crypto';

import type {
  ApiErrorItem,
  ApiErrorResponse,
  ApiSuccessResponse,
  CursorPaginatedResponse,
  CursorPaginationMeta,
  PaginatedResponse,
  PaginationMeta,
} from '../types/api-response';

function getRequestId(req?: Request): string {
  if (req && (req as any).requestId) return (req as any).requestId;
  return crypto.randomUUID();
}

export function buildSuccess<T>(
  data: T | null,
  message: string,
  req?: Request,
  meta?: Record<string, unknown>,
): ApiSuccessResponse<T> {
  return {
    success: true,
    message,
    data: data ?? null,
    meta: meta && Object.keys(meta).length > 0 ? meta : {},
    timestamp: new Date().toISOString(),
    requestId: getRequestId(req),
  };
}

export function buildError(
  message: string,
  code: string,
  req?: Request,
  errors?: ApiErrorItem[],
  details?: unknown,
): ApiErrorResponse {
  return {
    success: false,
    message,
    code,
    ...(errors && errors.length > 0 && { errors }),
    ...(details !== undefined && { details }),
    timestamp: new Date().toISOString(),
    requestId: getRequestId(req),
  };
}

export function buildPaginated<T>(
  data: T[],
  meta: PaginationMeta,
  message: string,
  req?: Request,
): PaginatedResponse<T> {
  return {
    success: true,
    message,
    data,
    meta,
    timestamp: new Date().toISOString(),
    requestId: getRequestId(req),
  };
}

export function buildCursorPaginated<T>(
  data: T[],
  meta: CursorPaginationMeta,
  message: string,
  req?: Request,
): CursorPaginatedResponse<T> {
  return {
    success: true,
    message,
    data,
    meta,
    timestamp: new Date().toISOString(),
    requestId: getRequestId(req),
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T | null,
  message: string,
  req?: Request,
  statusCode = 200,
  meta?: Record<string, unknown>,
): Response {
  if (statusCode === 204) return res.status(204).send();
  return res.status(statusCode).json(buildSuccess(data, message, req, meta));
}

export function sendError(
  res: Response,
  message: string,
  code: string,
  statusCode = 400,
  req?: Request,
  errors?: ApiErrorItem[],
  details?: unknown,
): Response {
  return res.status(statusCode).json(buildError(message, code, req, errors, details));
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  meta: PaginationMeta,
  message: string,
  req?: Request,
  statusCode = 200,
): Response {
  return res.status(statusCode).json(buildPaginated(data, meta, message, req));
}

export function sendCursorPaginated<T>(
  res: Response,
  data: T[],
  meta: CursorPaginationMeta,
  message: string,
  req?: Request,
  statusCode = 200,
): Response {
  return res.status(statusCode).json(buildCursorPaginated(data, meta, message, req));
}

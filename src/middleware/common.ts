import type { RequestHandler, ErrorRequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import crypto from 'crypto';
import { appConfig, ErrorCodes, HttpStatus } from '../config';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

type AsyncRequestHandler = (
  req: Parameters<RequestHandler>[0],
  res: Parameters<RequestHandler>[1],
  next: Parameters<RequestHandler>[2],
) => Promise<void>;

export function asyncHandler(fn: AsyncRequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export const requestIdMiddleware: RequestHandler = (req, _res, next) => {
  (req as any).requestId = crypto.randomUUID();
  next();
};

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(
    new AppError(
      `Route not found: ${req.method} ${req.originalUrl}`,
      HttpStatus.NOT_FOUND,
      ErrorCodes.NOT_FOUND,
    ),
  );
};

export function errorResponse<T>(
  message: string,
  data?: T,
  code?: string,
  details?: unknown,
) {
  return {
    success: false,
    message,
    code,
    data,
    details,
    timestamp: new Date().toISOString(),
  };
}

export function successResponse<T>(
  message: string,
  data?: T,
  meta?: Record<string, unknown>,
) {
  return {
    success: true,
    message,
    data,
    meta,
    timestamp: new Date().toISOString(),
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200,
): Response {
  const body: any = {
    success: true,
    ...(message && { message }),
    data,
    timestamp: new Date().toISOString(),
  };
  if (statusCode === 204) {
    return res.status(statusCode).send();
  }
  return res.status(statusCode).json(body);
}

const PRISMA_ERROR_MAP: Record<string, { statusCode: number; code: string; message: string }> = {
  P2002: { statusCode: HttpStatus.CONFLICT, code: ErrorCodes.CONFLICT, message: 'Unique constraint violation' },
  P2025: { statusCode: HttpStatus.NOT_FOUND, code: ErrorCodes.NOT_FOUND, message: 'Record not found' },
  P2003: { statusCode: HttpStatus.BAD_REQUEST, code: ErrorCodes.VALIDATION_ERROR, message: 'Foreign key constraint failed' },
  P2000: { statusCode: HttpStatus.BAD_REQUEST, code: ErrorCodes.VALIDATION_ERROR, message: 'Value too long for column' },
};

function mapPrismaError(err: any): { statusCode: number; code: string; message: string; details?: unknown } | null {
  if (!err || typeof err !== 'object' || !('code' in err)) return null;
  const mapped = PRISMA_ERROR_MAP[err.code];
  if (!mapped) return null;
  return { ...mapped, details: err.meta };
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(HttpStatus.BAD_REQUEST).json(
      errorResponse(
        'Validation Error',
        err.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
        ErrorCodes.VALIDATION_ERROR,
      ),
    );
    return;
  }

  const prismaError = mapPrismaError(err);
  if (prismaError) {
    res.status(prismaError.statusCode).json(
      errorResponse(prismaError.message, undefined, prismaError.code, prismaError.details),
    );
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json(errorResponse(err.message, undefined, err.code, err.details));
    return;
  }

  logger.error('Unhandled error', {
    message: err instanceof Error ? err.message : 'Unknown error',
    stack: err instanceof Error ? err.stack : undefined,
  });

  res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
    errorResponse(
      appConfig.isProduction
        ? 'Internal server error'
        : err instanceof Error
          ? err.message
          : 'Unknown error',
      undefined,
      ErrorCodes.INTERNAL_SERVER_ERROR,
      !appConfig.isProduction && err instanceof Error ? { stack: err.stack } : undefined,
    ),
  );
};

import type { RequestHandler, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import crypto from 'crypto';
import { appConfig, ErrorCodes, HttpStatus } from '../config';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';
import { buildError, sendError } from '../shared/utils/response';

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

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    sendError(
      res,
      'Validation failed',
      ErrorCodes.VALIDATION_ERROR,
      HttpStatus.BAD_REQUEST,
      req,
      err.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      })),
    );
    return;
  }

  const prismaError = mapPrismaError(err);
  if (prismaError) {
    sendError(
      res,
      prismaError.message,
      prismaError.code,
      prismaError.statusCode,
      req,
      undefined,
      prismaError.details,
    );
    return;
  }

  if (err instanceof AppError) {
    sendError(
      res,
      err.message,
      err.code,
      err.statusCode,
      req,
      undefined,
      err.details,
    );
    return;
  }

  logger.error('Unhandled error', {
    message: err instanceof Error ? err.message : 'Unknown error',
    stack: err instanceof Error ? err.stack : undefined,
    requestId: (req as any).requestId,
  });

  const message = appConfig.isProduction
    ? 'Internal server error'
    : err instanceof Error
      ? err.message
      : 'Unknown error';
  const details = !appConfig.isProduction && err instanceof Error
    ? { stack: err.stack }
    : undefined;

  res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
    buildError(message, ErrorCodes.INTERNAL_SERVER_ERROR, req, undefined, details),
  );
};

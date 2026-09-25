import type { Request, Response, RequestHandler, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import crypto from 'crypto';
import { JsonWebTokenError, NotBeforeError, TokenExpiredError } from 'jsonwebtoken';
import { appConfig, ErrorCodes, HttpStatus } from '../config';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';
import {
  logApiError,
  logApiRequestComplete,
  nextCheckForBlame,
  resolveApiBlame,
} from '../lib/api-diagnostics';
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

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const incoming = req.headers['x-request-id'];
  const id =
    typeof incoming === 'string' && incoming.trim().length > 0
      ? incoming.trim().slice(0, 64)
      : crypto.randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
};

/**
 * Logs every API call with blame + duration (skips noisy health OK).
 * Flutter should echo X-Request-ID / response.requestId when reporting bugs.
 */
export const requestDiagnosticsMiddleware: RequestHandler = (req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    const codeHeader = res.getHeader('X-Error-Code');
    const code =
      typeof codeHeader === 'string'
        ? codeHeader
        : Array.isArray(codeHeader)
          ? String(codeHeader[0])
          : undefined;
    logApiRequestComplete({
      req,
      statusCode: res.statusCode,
      durationMs: Date.now() - started,
      code,
    });
  });
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

function respondError(
  req: Request,
  res: Response,
  message: string,
  code: string,
  statusCode: number,
  errors?: { field?: string; message: string; code?: string }[],
  details?: unknown,
): void {
  res.setHeader('X-Error-Code', code);
  logApiError({ req, statusCode, code, message, details });
  sendError(res, message, code, statusCode, req, errors, details);
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    respondError(
      req,
      res,
      'Validation failed',
      ErrorCodes.VALIDATION_ERROR,
      HttpStatus.BAD_REQUEST,
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
    respondError(req, res, prismaError.message, prismaError.code, prismaError.statusCode, undefined, prismaError.details);
    return;
  }

  if (err instanceof AppError) {
    if (
      err.code === ErrorCodes.TAFSIR_TEMPORARILY_UNAVAILABLE &&
      err.details &&
      typeof err.details === 'object' &&
      typeof (err.details as { retryAfterSeconds?: unknown }).retryAfterSeconds === 'number'
    ) {
      const retryAfter = Math.max(
        1,
        Math.ceil((err.details as { retryAfterSeconds: number }).retryAfterSeconds),
      );
      res.setHeader('Retry-After', String(retryAfter));
    }
    respondError(
      req,
      res,
      err.message,
      err.code,
      err.statusCode,
      undefined,
      err.code === ErrorCodes.TAFSIR_TEMPORARILY_UNAVAILABLE ? undefined : err.details,
    );
    return;
  }

  if (err instanceof TokenExpiredError) {
    respondError(req, res, 'Token expired', ErrorCodes.TOKEN_EXPIRED, HttpStatus.UNAUTHORIZED);
    return;
  }

  if (err instanceof JsonWebTokenError || err instanceof NotBeforeError) {
    respondError(req, res, 'Invalid token', ErrorCodes.INVALID_TOKEN, HttpStatus.UNAUTHORIZED);
    return;
  }

  if (err && typeof err === 'object' && typeof (err as any).code === 'string' && (err as any).code.startsWith('P')) {
    logger.error('Prisma error', {
      prismaCode: (err as any).code,
      meta: (err as any).meta,
      message: (err as any).message,
      requestId: req.requestId,
      path: req.originalUrl ?? req.url,
    });
    respondError(
      req,
      res,
      appConfig.isProduction ? 'Database error' : `Database error: ${(err as any).code}`,
      ErrorCodes.DATABASE_ERROR,
      HttpStatus.INTERNAL_SERVER_ERROR,
      undefined,
      !appConfig.isProduction ? { prismaCode: (err as any).code, meta: (err as any).meta } : undefined,
    );
    return;
  }

  const message = appConfig.isProduction
    ? 'Internal server error'
    : err instanceof Error
      ? err.message
      : 'Unknown error';
  const details = !appConfig.isProduction && err instanceof Error
    ? { stack: err.stack }
    : undefined;

  res.setHeader('X-Error-Code', ErrorCodes.INTERNAL_SERVER_ERROR);
  logApiError({
    req,
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    code: ErrorCodes.INTERNAL_SERVER_ERROR,
    message: err instanceof Error ? err.message : 'Unknown error',
  });
  logger.error('Unhandled error', {
    message: err instanceof Error ? err.message : 'Unknown error',
    stack: err instanceof Error ? err.stack : undefined,
    requestId: req.requestId,
    blame: resolveApiBlame(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCodes.INTERNAL_SERVER_ERROR),
    nextCheck: nextCheckForBlame('BACKEND'),
  });

  res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
    buildError(message, ErrorCodes.INTERNAL_SERVER_ERROR, req, undefined, details, {
      blame: 'BACKEND',
      nextCheck: nextCheckForBlame('BACKEND'),
    }),
  );
};

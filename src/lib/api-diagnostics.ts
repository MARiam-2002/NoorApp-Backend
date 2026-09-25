/**
 * App-wide API diagnostics (2026).
 * Structured logs + optional error `blame` so on-call / Flutter can tell
 * Backend vs client (APK) vs auth vs validation issues.
 */

import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { ErrorCodes } from '../config';
import { logger } from './logger';

export type ApiBlame =
  | 'OK'
  | 'FLUTTER_CLIENT' // bad request, validation, wrong route, missing headers
  | 'FLUTTER_AUTH' // missing/expired/invalid token
  | 'FLUTTER_RATE_LIMIT' // client hammering API
  | 'BACKEND' // 5xx, DB, internal
  | 'NOT_FOUND' // route or resource — often Flutter wrong path/id
  | 'CONFLICT' // duplicate / state conflict
  | 'UNKNOWN';

export function resolveApiBlame(statusCode: number, code?: string): ApiBlame {
  if (statusCode >= 200 && statusCode < 400) return 'OK';
  if (code === ErrorCodes.RATE_LIMIT_EXCEEDED || statusCode === 429) return 'FLUTTER_RATE_LIMIT';
  if (
    code === ErrorCodes.UNAUTHORIZED ||
    code === ErrorCodes.TOKEN_EXPIRED ||
    code === ErrorCodes.INVALID_TOKEN ||
    statusCode === 401 ||
    statusCode === 403
  ) {
    return 'FLUTTER_AUTH';
  }
  if (code === ErrorCodes.VALIDATION_ERROR || statusCode === 400) return 'FLUTTER_CLIENT';
  if (code === ErrorCodes.CONFLICT || statusCode === 409) return 'CONFLICT';
  if (code === ErrorCodes.NOT_FOUND || statusCode === 404) return 'NOT_FOUND';
  if (statusCode >= 500) return 'BACKEND';
  return 'UNKNOWN';
}

export function nextCheckForBlame(blame: ApiBlame): string | undefined {
  switch (blame) {
    case 'FLUTTER_CLIENT':
      return 'Check request body/query against contract; log requestId from response.';
    case 'FLUTTER_AUTH':
      return 'Refresh access token / re-login; send Authorization: Bearer.';
    case 'FLUTTER_RATE_LIMIT':
      return 'Debounce PATCH/polling; wait for Retry-After / window reset.';
    case 'NOT_FOUND':
      return 'Verify path + id; compare with Swagger / Flutter contract.';
    case 'CONFLICT':
      return 'Resource already exists or invalid state transition.';
    case 'BACKEND':
      return 'Check Railway logs for this requestId; DB/FCM/provider failure.';
    default:
      return undefined;
  }
}

function routeTemplate(req: Request): string {
  // Prefer Express matched route (stable) over raw URL with ids/query.
  const base = (req.baseUrl || '') + (req.route?.path ? String(req.route.path) : '');
  if (base) return `${req.method} ${base}`;
  const pathOnly = (req.originalUrl || req.url || '').split('?')[0] || '/';
  return `${req.method} ${pathOnly}`;
}

/** Who hit the API — for support when something breaks. */
export type RequestUserIdentity = {
  userId?: string;
  userEmail?: string;
};

/**
 * Prefer req.user (after authenticate); else decode Bearer JWT (even if expired)
 * so failed auth / mid-flight errors still show which account.
 */
export function identityFromReq(req: Request): RequestUserIdentity {
  if (req.user?.sub) {
    return {
      userId: req.user.sub,
      userEmail: typeof req.user.email === 'string' ? req.user.email : undefined,
    };
  }
  const raw = req.headers.authorization;
  const header = Array.isArray(raw) ? raw[0] : raw;
  if (!header || !header.toLowerCase().startsWith('bearer ')) return {};
  const token = header.slice(7).trim();
  if (!token) return {};
  try {
    // Decode only — do not verify here (logging identity of expired tokens too).
    const payload = jwt.decode(token) as { userId?: string; sub?: string; email?: string } | null;
    if (!payload || typeof payload !== 'object') return {};
    const userId =
      (typeof payload.userId === 'string' && payload.userId) ||
      (typeof payload.sub === 'string' && payload.sub) ||
      undefined;
    const userEmail = typeof payload.email === 'string' ? payload.email : undefined;
    return { userId, userEmail };
  } catch {
    return {};
  }
}

/** Skip noisy health / docs / static-ish paths from info logs (still log errors). */
export function shouldSkipRequestInfoLog(req: Request): boolean {
  const p = (req.originalUrl || req.url || '').split('?')[0] || '';
  return (
    p === '/api/v1/health' ||
    p === '/health' ||
    p.startsWith('/api/v1/docs') ||
    p === '/' ||
    p.startsWith('/favicon')
  );
}

export function logApiRequestComplete(input: {
  req: Request;
  statusCode: number;
  durationMs: number;
  code?: string;
}): void {
  const blame = resolveApiBlame(input.statusCode, input.code);
  const skipInfo = shouldSkipRequestInfoLog(input.req) && blame === 'OK';
  if (skipInfo) return;

  const who = identityFromReq(input.req);
  const meta = {
    event: 'api_request',
    blame,
    requestId: input.req.requestId,
    userId: who.userId,
    userEmail: who.userEmail,
    method: input.req.method,
    path: (input.req.originalUrl || input.req.url || '').split('?')[0],
    route: routeTemplate(input.req),
    statusCode: input.statusCode,
    durationMs: input.durationMs,
    code: input.code,
    nextCheck: nextCheckForBlame(blame),
  };

  if (blame === 'BACKEND' || input.statusCode >= 500) {
    logger.error('[API] request', meta);
  } else if (blame === 'OK') {
    logger.info('[API] request', meta);
  } else {
    logger.warn('[API] request', meta);
  }
}

export function logApiError(input: {
  req: Request;
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}): ApiBlame {
  const blame = resolveApiBlame(input.statusCode, input.code);
  const who = identityFromReq(input.req);
  const meta = {
    event: 'api_error',
    blame,
    requestId: input.req.requestId,
    userId: who.userId,
    userEmail: who.userEmail,
    method: input.req.method,
    path: (input.req.originalUrl || input.req.url || '').split('?')[0],
    route: routeTemplate(input.req),
    statusCode: input.statusCode,
    code: input.code,
    message: input.message,
    nextCheck: nextCheckForBlame(blame),
    // Avoid dumping huge Zod trees; keep small
    detailsPreview:
      input.details != null
        ? typeof input.details === 'string'
          ? input.details.slice(0, 200)
          : undefined
        : undefined,
  };

  if (blame === 'BACKEND') {
    logger.error('[API] error', meta);
  } else {
    logger.warn('[API] error', meta);
  }
  return blame;
}

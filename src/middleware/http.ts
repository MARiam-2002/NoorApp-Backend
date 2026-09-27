import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import crypto from 'crypto';
import helmet from 'helmet';
import hpp from 'hpp';
import morgan from 'morgan';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Express, Request, Response } from 'express';
import { appConfig, env, ErrorCodes, HttpStatus } from '../config';
import { morganStream } from '../lib/logger';
import { nextCheckForBlame, resolveApiBlame } from '../lib/api-diagnostics';
import { buildError } from '../shared/utils/response';

/**
 * Per-user when Bearer is present (shared Wi‑Fi / CGNAT must not share one bucket).
 * Falls back to IP for anonymous traffic.
 */
function apiClientKey(req: Request): string {
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ') && auth.length > 20) {
    const token = auth.slice(7).trim();
    if (token) {
      return `tok:${crypto.createHash('sha256').update(token).digest('hex').slice(0, 32)}`;
    }
  }
  return ipKeyGenerator(req.ip ?? 'unknown');
}

/** Audio streaming must not burn the same quota as JSON APIs. */
function isPublicMediaStream(req: Request): boolean {
  const url = req.originalUrl || req.url || '';
  return /\/api\/v1\/(azan|salawat)\/media\//i.test(url);
}

function buildCorsOriginOption(): cors.CorsOptions['origin'] {
  const raw = (env.CORS_ORIGIN || '').trim();
  if (!raw) return false;
  if (raw === '*') {
    // Reflect request origin when wildcard is explicitly configured.
    // Prefer an explicit allow-list in production (comma-separated CORS_ORIGIN).
    return true;
  }
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.length === 0) return false;
  if (list.length === 1) return list[0];
  return (origin, callback) => {
    if (!origin || list.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  };
}

export function applySecurityMiddlewares(app: Express): void {
  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(
    cors({
      origin: buildCorsOriginOption(),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-Request-ID',
        'X-Cron-Secret',
      ],
    }),
  );
  app.use(compression());
  app.use(hpp());
  app.use(cookieParser());
}

// Privacy Policy promises no IP / user-agent / query string (coordinates) in request logs.
morgan.token('path-only', (req) => ((req as Request).originalUrl || req.url || '').split('?')[0]);

export const httpLogger = morgan(
  appConfig.isProduction
    ? ':method :path-only :status :res[content-length] - :response-time ms'
    : 'dev',
  { stream: morganStream },
);

function buildRateLimitMessage(message: string) {
  return (_req: Request, _res: Response): unknown => {
    const blame = resolveApiBlame(HttpStatus.TOO_MANY_REQUESTS, ErrorCodes.RATE_LIMIT_EXCEEDED);
    return buildError(message, ErrorCodes.RATE_LIMIT_EXCEEDED, _req, undefined, undefined, {
      blame,
      nextCheck: nextCheckForBlame(blame),
    });
  };
}

export const apiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: apiClientKey,
  skip: isPublicMediaStream,
  message: buildRateLimitMessage('Too many requests, please try again later'),
  statusCode: HttpStatus.TOO_MANY_REQUESTS,
});

/*
 * Auth limiters are keyed by the thing being protected (email / token / user), not only IP:
 * mobile carriers (CGNAT) put many real users behind one IP, so per-IP-only limits lock
 * out innocent users. Every limiter keeps the same 429 envelope Flutter already handles.
 */
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

function ipKey(req: Request): string {
  return `ip:${ipKeyGenerator(req.ip ?? 'unknown')}`;
}

function hashedKey(prefix: string, value: string): string {
  return `${prefix}:${crypto.createHash('sha256').update(value).digest('hex').slice(0, 32)}`;
}

function bodyEmailKey(req: Request): string {
  const email = (req.body as { email?: unknown } | undefined)?.email;
  if (typeof email === 'string' && email.trim()) {
    return hashedKey('email', email.trim().toLowerCase());
  }
  return ipKey(req);
}

function bodyResetTokenKey(req: Request): string {
  const token = (req.body as { token?: unknown } | undefined)?.token;
  if (typeof token === 'string' && token.trim()) {
    return hashedKey('reset', token.trim());
  }
  return ipKey(req);
}

function authLimiter(opts: {
  windowMs: number;
  max: number;
  message: string;
  keyGenerator: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
}) {
  return rateLimit({
    windowMs: opts.windowMs,
    max: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: opts.keyGenerator,
    skipSuccessfulRequests: opts.skipSuccessfulRequests ?? false,
    message: buildRateLimitMessage(opts.message),
    statusCode: HttpStatus.TOO_MANY_REQUESTS,
  });
}

/** Per-IP backstop for every /auth route (sized for shared carrier IPs). */
export const authRateLimiter = authLimiter({
  windowMs: 15 * MINUTE,
  max: 300,
  keyGenerator: ipKey,
  message: 'Too many auth attempts, please try again later',
});

/** Brute-force guard per account: only failed logins count. */
export const loginEmailRateLimiter = authLimiter({
  windowMs: 15 * MINUTE,
  max: 10,
  keyGenerator: bodyEmailKey,
  skipSuccessfulRequests: true,
  message: 'Too many failed login attempts for this account, please try again later',
});

/** Credential-stuffing guard across many emails from one IP: only failed logins count. */
export const loginIpRateLimiter = authLimiter({
  windowMs: 15 * MINUTE,
  max: 100,
  keyGenerator: ipKey,
  skipSuccessfulRequests: true,
  message: 'Too many failed login attempts, please try again later',
});

export const signUpRateLimiter = authLimiter({
  windowMs: HOUR,
  max: 30,
  keyGenerator: ipKey,
  message: 'Too many sign-up attempts, please try again later',
});

/** Prevents reset-email bombing of one inbox. */
export const forgotPasswordRateLimiter = authLimiter({
  windowMs: HOUR,
  max: 5,
  keyGenerator: bodyEmailKey,
  message: 'Too many password reset requests for this email, please try again in an hour',
});

export const resetPasswordRateLimiter = authLimiter({
  windowMs: HOUR,
  max: 10,
  keyGenerator: bodyResetTokenKey,
  message: 'Too many password reset attempts, please try again in an hour',
});

/** Authenticated route: keyed by the caller's access token. */
export const deleteAccountRateLimiter = authLimiter({
  windowMs: HOUR,
  max: 5,
  keyGenerator: apiClientKey,
  message: 'Too many account deletion attempts, please try again in an hour',
});

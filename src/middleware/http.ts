import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import type { Express } from 'express';
import { appConfig, env, ErrorCodes, HttpStatus } from '../config';
import { morganStream } from '../lib/logger';

export function applySecurityMiddlewares(app: Express): void {
  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: appConfig.isProduction ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID'],
    }),
  );
  app.use(compression());
  app.use(hpp());
  app.use(cookieParser());
}

export const httpLogger = morgan(appConfig.isProduction ? 'combined' : 'dev', {
  stream: morganStream,
});

export const apiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: ErrorCodes.RATE_LIMIT_EXCEEDED,
    message: 'Too many requests, please try again later',
  },
  statusCode: HttpStatus.TOO_MANY_REQUESTS,
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: ErrorCodes.RATE_LIMIT_EXCEEDED,
    message: 'Too many auth attempts, please try again later',
  },
  statusCode: HttpStatus.TOO_MANY_REQUESTS,
});

export const authSensitiveRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: ErrorCodes.RATE_LIMIT_EXCEEDED,
    message: 'Too many sensitive requests, please try again in an hour',
  },
  statusCode: HttpStatus.TOO_MANY_REQUESTS,
});

import './load-env';
import { z } from 'zod';

const API_PREFIX = '/api/v1';

const Environment = {
  Development: 'development',
  Staging: 'staging',
  Production: 'production',
  Test: 'test',
} as const;

const envSchema = z.object({
  NODE_ENV: z
    .enum([Environment.Development, Environment.Staging, Environment.Production, Environment.Test])
    .default(Environment.Development),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('1h'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().default('90d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  SWAGGER_ENABLED: z.enum(['true', 'false']).default('true').transform(v => v === 'true'),
  SWAGGER_TITLE: z.string().default('Noor API'),
  SWAGGER_DESCRIPTION: z.string().default('Noor REST API'),
  SWAGGER_VERSION: z.string().default('1.0.0'),
  MAIL_ENABLED: z.enum(['true', 'false']).default('false').transform(v => v === 'true'),
  MAIL_HOST: z.string().default('smtp.gmail.com'),
  MAIL_PORT: z.coerce.number().int().positive().default(587),
  MAIL_SECURE: z.enum(['true', 'false']).default('false').transform(v => v === 'true'),
  MAIL_USER: z.string().default(''),
  MAIL_PASSWORD: z.string().default(''),
  MAIL_FROM: z.string().default(''),
  RESEND_API_KEY: z.string().default(''),
  EMAIL_PROVIDER: z.enum(['auto', 'resend', 'smtp']).default('auto'),
  RESET_PASSWORD_DEEPLINK: z.string().default('noorapp://auth/reset-password?token={{token}}'),
  STORAGE_PROVIDER: z.enum(['local', 's3', 'cloudinary']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('uploads'),
  STORAGE_LOCAL_PUBLIC_URL: z.string().default('http://localhost:3000/uploads'),
  CACHE_PROVIDER: z.enum(['memory', 'redis']).default('memory'),
  CACHE_DEFAULT_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_CALLBACK_URL: z.string().default('http://localhost:3000/api/v1/auth/google/callback'),
});

type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment variables:\n${formatted}`);
  }
  return result.data;
}

export const env = parseEnv();

export const appConfig = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  apiPrefix: API_PREFIX,
  isProduction: env.NODE_ENV === Environment.Production,
  isDevelopment: env.NODE_ENV === Environment.Development,
  isStaging: env.NODE_ENV === Environment.Staging,
  isTest: env.NODE_ENV === Environment.Test,
} as const;

export const getApiBasePath = (): string => API_PREFIX;

export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  REFRESH_TOKEN_REQUIRED: 'REFRESH_TOKEN_REQUIRED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCodes = exports.HttpStatus = exports.getApiBasePath = exports.appConfig = exports.env = void 0;
require("./load-env");
const zod_1 = require("zod");
const API_PREFIX = '/api/v1';
const Environment = {
    Development: 'development',
    Staging: 'staging',
    Production: 'production',
    Test: 'test',
};
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z
        .enum([Environment.Development, Environment.Staging, Environment.Production, Environment.Test])
        .default(Environment.Development),
    PORT: zod_1.z.coerce.number().int().positive().default(3000),
    DATABASE_URL: zod_1.z.string().min(1),
    CORS_ORIGIN: zod_1.z.string().default('http://localhost:3000'),
    RATE_LIMIT_WINDOW_MS: zod_1.z.coerce.number().int().positive().default(900_000),
    RATE_LIMIT_MAX: zod_1.z.coerce.number().int().positive().default(100),
    JWT_SECRET: zod_1.z.string().min(32),
    JWT_EXPIRES_IN: zod_1.z.string().default('7d'),
    JWT_REFRESH_SECRET: zod_1.z.string().min(32),
    JWT_REFRESH_EXPIRES_IN: zod_1.z.string().default('30d'),
    BCRYPT_SALT_ROUNDS: zod_1.z.coerce.number().int().min(10).max(15).default(12),
    LOG_LEVEL: zod_1.z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
    SWAGGER_ENABLED: zod_1.z.enum(['true', 'false']).default('true').transform(v => v === 'true'),
    SWAGGER_TITLE: zod_1.z.string().default('Noor API'),
    SWAGGER_DESCRIPTION: zod_1.z.string().default('Noor REST API'),
    SWAGGER_VERSION: zod_1.z.string().default('1.0.0'),
    MAIL_ENABLED: zod_1.z.enum(['true', 'false']).default('false').transform(v => v === 'true'),
    MAIL_HOST: zod_1.z.string().default('smtp.gmail.com'),
    MAIL_PORT: zod_1.z.coerce.number().int().positive().default(587),
    MAIL_SECURE: zod_1.z.enum(['true', 'false']).default('false').transform(v => v === 'true'),
    MAIL_USER: zod_1.z.string().default(''),
    MAIL_PASSWORD: zod_1.z.string().default(''),
    MAIL_FROM: zod_1.z.string().default('Noor API <noreply@noor.app>'),
    STORAGE_PROVIDER: zod_1.z.enum(['local', 's3', 'cloudinary']).default('local'),
    STORAGE_LOCAL_DIR: zod_1.z.string().default('uploads'),
    STORAGE_LOCAL_PUBLIC_URL: zod_1.z.string().default('http://localhost:3000/uploads'),
    CACHE_PROVIDER: zod_1.z.enum(['memory', 'redis']).default('memory'),
    CACHE_DEFAULT_TTL_SECONDS: zod_1.z.coerce.number().int().positive().default(300),
    REDIS_URL: zod_1.z.string().default('redis://localhost:6379'),
    GOOGLE_CLIENT_ID: zod_1.z.string().default(''),
    GOOGLE_CLIENT_SECRET: zod_1.z.string().default(''),
    GOOGLE_CALLBACK_URL: zod_1.z.string().default('http://localhost:3000/api/v1/auth/google/callback'),
});
function parseEnv() {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
        const formatted = result.error.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
        throw new Error(`Invalid environment variables:\n${formatted}`);
    }
    return result.data;
}
exports.env = parseEnv();
exports.appConfig = {
    nodeEnv: exports.env.NODE_ENV,
    port: exports.env.PORT,
    apiPrefix: API_PREFIX,
    isProduction: exports.env.NODE_ENV === Environment.Production,
    isDevelopment: exports.env.NODE_ENV === Environment.Development,
    isStaging: exports.env.NODE_ENV === Environment.Staging,
    isTest: exports.env.NODE_ENV === Environment.Test,
};
const getApiBasePath = () => API_PREFIX;
exports.getApiBasePath = getApiBasePath;
exports.HttpStatus = {
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
};
exports.ErrorCodes = {
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
};
//# sourceMappingURL=config.js.map
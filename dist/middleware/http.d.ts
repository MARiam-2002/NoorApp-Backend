import type { Express } from 'express';
export declare function applySecurityMiddlewares(app: Express): void;
export declare const httpLogger: (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse<import("node:http").IncomingMessage>, callback: (err?: Error) => void) => void;
export declare const apiRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const authRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const authSensitiveRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
//# sourceMappingURL=http.d.ts.map
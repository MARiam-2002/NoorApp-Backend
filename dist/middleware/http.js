"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authSensitiveRateLimiter = exports.authRateLimiter = exports.apiRateLimiter = exports.httpLogger = void 0;
exports.applySecurityMiddlewares = applySecurityMiddlewares;
const compression_1 = __importDefault(require("compression"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const hpp_1 = __importDefault(require("hpp"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const config_1 = require("../config");
const logger_1 = require("../lib/logger");
function applySecurityMiddlewares(app) {
    app.set('trust proxy', 1);
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: config_1.appConfig.isProduction ? undefined : false,
        crossOriginEmbedderPolicy: false,
    }));
    app.use((0, cors_1.default)({
        origin: config_1.env.CORS_ORIGIN,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID'],
    }));
    app.use((0, compression_1.default)());
    app.use((0, hpp_1.default)());
    app.use((0, cookie_parser_1.default)());
}
exports.httpLogger = (0, morgan_1.default)(config_1.appConfig.isProduction ? 'combined' : 'dev', {
    stream: logger_1.morganStream,
});
exports.apiRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: config_1.env.RATE_LIMIT_WINDOW_MS,
    max: config_1.env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        code: config_1.ErrorCodes.RATE_LIMIT_EXCEEDED,
        message: 'Too many requests, please try again later',
    },
    statusCode: config_1.HttpStatus.TOO_MANY_REQUESTS,
});
exports.authRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        code: config_1.ErrorCodes.RATE_LIMIT_EXCEEDED,
        message: 'Too many auth attempts, please try again later',
    },
    statusCode: config_1.HttpStatus.TOO_MANY_REQUESTS,
});
exports.authSensitiveRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        code: config_1.ErrorCodes.RATE_LIMIT_EXCEEDED,
        message: 'Too many sensitive requests, please try again in an hour',
    },
    statusCode: config_1.HttpStatus.TOO_MANY_REQUESTS,
});
//# sourceMappingURL=http.js.map
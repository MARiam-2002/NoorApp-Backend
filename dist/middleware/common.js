"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.notFoundHandler = exports.requestIdMiddleware = void 0;
exports.asyncHandler = asyncHandler;
exports.errorResponse = errorResponse;
exports.successResponse = successResponse;
exports.sendSuccess = sendSuccess;
const zod_1 = require("zod");
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("../config");
const errors_1 = require("../lib/errors");
const logger_1 = require("../lib/logger");
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
const requestIdMiddleware = (req, _res, next) => {
    req.requestId = crypto_1.default.randomUUID();
    next();
};
exports.requestIdMiddleware = requestIdMiddleware;
const notFoundHandler = (req, _res, next) => {
    next(new errors_1.AppError(`Route not found: ${req.method} ${req.originalUrl}`, config_1.HttpStatus.NOT_FOUND, config_1.ErrorCodes.NOT_FOUND));
};
exports.notFoundHandler = notFoundHandler;
function errorResponse(message, data, code, details) {
    return {
        success: false,
        message,
        code,
        data,
        details,
        timestamp: new Date().toISOString(),
    };
}
function successResponse(message, data, meta) {
    return {
        success: true,
        message,
        data,
        meta,
        timestamp: new Date().toISOString(),
    };
}
function sendSuccess(res, data, message, statusCode = 200) {
    const body = {
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
const PRISMA_ERROR_MAP = {
    P2002: { statusCode: config_1.HttpStatus.CONFLICT, code: config_1.ErrorCodes.CONFLICT, message: 'Unique constraint violation' },
    P2025: { statusCode: config_1.HttpStatus.NOT_FOUND, code: config_1.ErrorCodes.NOT_FOUND, message: 'Record not found' },
    P2003: { statusCode: config_1.HttpStatus.BAD_REQUEST, code: config_1.ErrorCodes.VALIDATION_ERROR, message: 'Foreign key constraint failed' },
    P2000: { statusCode: config_1.HttpStatus.BAD_REQUEST, code: config_1.ErrorCodes.VALIDATION_ERROR, message: 'Value too long for column' },
};
function mapPrismaError(err) {
    if (!err || typeof err !== 'object' || !('code' in err))
        return null;
    const mapped = PRISMA_ERROR_MAP[err.code];
    if (!mapped)
        return null;
    return { ...mapped, details: err.meta };
}
const errorHandler = (err, _req, res, _next) => {
    if (err instanceof zod_1.ZodError) {
        res.status(config_1.HttpStatus.BAD_REQUEST).json(errorResponse('Validation Error', err.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
        })), config_1.ErrorCodes.VALIDATION_ERROR));
        return;
    }
    const prismaError = mapPrismaError(err);
    if (prismaError) {
        res.status(prismaError.statusCode).json(errorResponse(prismaError.message, undefined, prismaError.code, prismaError.details));
        return;
    }
    if (err instanceof errors_1.AppError) {
        res.status(err.statusCode).json(errorResponse(err.message, undefined, err.code, err.details));
        return;
    }
    logger_1.logger.error('Unhandled error', {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
    });
    res.status(config_1.HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse(config_1.appConfig.isProduction
        ? 'Internal server error'
        : err instanceof Error
            ? err.message
            : 'Unknown error', undefined, config_1.ErrorCodes.INTERNAL_SERVER_ERROR, !config_1.appConfig.isProduction && err instanceof Error ? { stack: err.stack } : undefined));
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=common.js.map
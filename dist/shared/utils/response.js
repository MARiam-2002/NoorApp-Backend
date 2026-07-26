"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.successResponse = successResponse;
exports.errorResponse = errorResponse;
exports.paginatedResponse = paginatedResponse;
exports.cursorPaginatedResponse = cursorPaginatedResponse;
exports.sendSuccess = sendSuccess;
exports.sendError = sendError;
exports.sendPaginated = sendPaginated;
exports.sendCursorPaginated = sendCursorPaginated;
function successResponse(data, message) {
    return {
        success: true,
        ...(message && { message }),
        data,
    };
}
function errorResponse(message, errors, code, details) {
    return {
        success: false,
        message,
        ...(errors && errors.length > 0 && { errors }),
        ...(code && { code }),
        ...(details !== undefined && { details }),
    };
}
function paginatedResponse(data, meta, message) {
    return {
        success: true,
        ...(message && { message }),
        data,
        meta,
    };
}
function cursorPaginatedResponse(data, meta, message) {
    return {
        success: true,
        ...(message && { message }),
        data,
        meta,
    };
}
function sendSuccess(res, data, message, statusCode = 200) {
    return res.status(statusCode).json(successResponse(data, message));
}
function sendError(res, message, statusCode = 400, errors, code, details) {
    return res.status(statusCode).json(errorResponse(message, errors, code, details));
}
function sendPaginated(res, data, meta, message, statusCode = 200) {
    return res.status(statusCode).json(paginatedResponse(data, meta, message));
}
function sendCursorPaginated(res, data, meta, message, statusCode = 200) {
    return res.status(statusCode).json(cursorPaginatedResponse(data, meta, message));
}
//# sourceMappingURL=response.js.map
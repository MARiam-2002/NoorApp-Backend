"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_CURSOR_LIMIT = exports.DEFAULT_CURSOR_LIMIT = void 0;
exports.parseCursorPaginationQuery = parseCursorPaginationQuery;
exports.buildCursorPaginationMeta = buildCursorPaginationMeta;
exports.encodeCursor = encodeCursor;
exports.decodeCursor = decodeCursor;
const DEFAULT_CURSOR_LIMIT = 20;
exports.DEFAULT_CURSOR_LIMIT = DEFAULT_CURSOR_LIMIT;
const MAX_CURSOR_LIMIT = 100;
exports.MAX_CURSOR_LIMIT = MAX_CURSOR_LIMIT;
function parseCursorPaginationQuery(limit, cursor) {
    return {
        limit: Math.min(MAX_CURSOR_LIMIT, Math.max(1, Number(limit) || DEFAULT_CURSOR_LIMIT)),
        ...(cursor && { cursor }),
    };
}
function buildCursorPaginationMeta(limit, nextCursor, previousCursor) {
    return {
        limit,
        nextCursor,
        previousCursor,
        hasNextPage: nextCursor !== null,
        hasPreviousPage: previousCursor !== null,
    };
}
function encodeCursor(value) {
    return Buffer.from(String(value)).toString('base64url');
}
function decodeCursor(cursor) {
    return Buffer.from(cursor, 'base64url').toString('utf-8');
}
//# sourceMappingURL=cursor-pagination.js.map
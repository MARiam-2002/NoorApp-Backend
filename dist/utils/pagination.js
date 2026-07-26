"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePaginationQuery = parsePaginationQuery;
exports.buildPaginationMeta = buildPaginationMeta;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
function parsePaginationQuery(page, limit) {
    const parsedPage = Math.max(DEFAULT_PAGE, Number(page) || DEFAULT_PAGE);
    const parsedLimit = Math.min(MAX_LIMIT, Math.max(1, Number(limit) || DEFAULT_LIMIT));
    return {
        page: parsedPage,
        limit: parsedLimit,
        skip: (parsedPage - 1) * parsedLimit,
    };
}
function buildPaginationMeta(page, limit, total) {
    const totalPages = Math.ceil(total / limit) || 1;
    return {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
    };
}
//# sourceMappingURL=pagination.js.map
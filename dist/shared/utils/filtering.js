"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFilterQuery = parseFilterQuery;
exports.buildSearchFilter = buildSearchFilter;
exports.buildExactFilter = buildExactFilter;
function parseFilterQuery(query) {
    return {
        ...(query.search?.trim() && { search: query.search.trim() }),
        ...(query.status?.trim() && { status: query.status.trim() }),
        ...(query.category?.trim() && { category: query.category.trim() }),
    };
}
function buildSearchFilter(search, fields) {
    if (!search) {
        return undefined;
    }
    return {
        OR: fields.map((field) => ({
            [field]: { contains: search, mode: 'insensitive' },
        })),
    };
}
function buildExactFilter(field, value) {
    if (!value) {
        return undefined;
    }
    return { [field]: value };
}
//# sourceMappingURL=filtering.js.map
import type { PaginationMeta, PaginationQuery } from '../types/api-response';
declare const DEFAULT_PAGE = 1;
declare const DEFAULT_LIMIT = 20;
declare const MAX_LIMIT = 100;
export declare function parsePaginationQuery(page?: number | string, limit?: number | string): PaginationQuery;
export declare function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta;
export { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT };
//# sourceMappingURL=pagination.d.ts.map
export type PaginationQuery = {
    page: number;
    limit: number;
    skip: number;
};
export type PaginationMeta = {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
};
export declare function parsePaginationQuery(page?: number | string, limit?: number | string): PaginationQuery;
export declare function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta;
//# sourceMappingURL=pagination.d.ts.map
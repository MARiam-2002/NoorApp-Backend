import type { FilterQuery } from '../types/api-response';
export declare function parseFilterQuery(query: {
    search?: string;
    status?: string;
    category?: string;
}): FilterQuery;
export declare function buildSearchFilter(search: string | undefined, fields: string[]): {
    OR: Array<Record<string, {
        contains: string;
        mode: 'insensitive';
    }>>;
} | undefined;
export declare function buildExactFilter(field: string, value: string | undefined): Record<string, string> | undefined;
//# sourceMappingURL=filtering.d.ts.map
import type { SortQuery } from '../types/api-response';
export declare function parseSortQuery(sort?: string, allowedFields?: string[], defaultField?: string): SortQuery;
export declare function buildOrderBy(sort: SortQuery): Record<string, 'asc' | 'desc'>;
export declare function parseMultiSortQuery(sort?: string | string[], allowedFields?: string[]): SortQuery[];
//# sourceMappingURL=sorting.d.ts.map
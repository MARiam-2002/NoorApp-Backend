import type { CursorPaginationMeta, CursorPaginationQuery } from '../types/api-response';
declare const DEFAULT_CURSOR_LIMIT = 20;
declare const MAX_CURSOR_LIMIT = 100;
export declare function parseCursorPaginationQuery(limit?: number | string, cursor?: string): CursorPaginationQuery;
export declare function buildCursorPaginationMeta(limit: number, nextCursor: string | null, previousCursor: string | null): CursorPaginationMeta;
export declare function encodeCursor(value: string | number | Date): string;
export declare function decodeCursor(cursor: string): string;
export { DEFAULT_CURSOR_LIMIT, MAX_CURSOR_LIMIT };
//# sourceMappingURL=cursor-pagination.d.ts.map
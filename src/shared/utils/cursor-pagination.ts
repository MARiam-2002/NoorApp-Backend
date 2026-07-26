import type { CursorPaginationMeta, CursorPaginationQuery } from '../types/api-response';

const DEFAULT_CURSOR_LIMIT = 20;
const MAX_CURSOR_LIMIT = 100;

export function parseCursorPaginationQuery(
  limit?: number | string,
  cursor?: string,
): CursorPaginationQuery {
  return {
    limit: Math.min(MAX_CURSOR_LIMIT, Math.max(1, Number(limit) || DEFAULT_CURSOR_LIMIT)),
    ...(cursor && { cursor }),
  };
}

export function buildCursorPaginationMeta(
  limit: number,
  nextCursor: string | null,
  previousCursor: string | null,
): CursorPaginationMeta {
  return {
    limit,
    nextCursor,
    previousCursor,
    hasNextPage: nextCursor !== null,
    hasPreviousPage: previousCursor !== null,
  };
}

export function encodeCursor(value: string | number | Date): string {
  return Buffer.from(String(value)).toString('base64url');
}

export function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64url').toString('utf-8');
}

export { DEFAULT_CURSOR_LIMIT, MAX_CURSOR_LIMIT };

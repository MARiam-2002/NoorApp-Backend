export type ApiErrorItem = {
  field?: string;
  message: string;
  code?: string;
};

export type ApiBase = {
  timestamp: string;
  requestId: string;
};

export type ApiSuccessResponse<T> = ApiBase & {
  success: true;
  message: string;
  data: T | null;
  meta: Record<string, unknown>;
};

export type ApiErrorResponse = ApiBase & {
  success: false;
  message: string;
  code: string;
  errors?: ApiErrorItem[];
  details?: unknown;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type PaginatedResponse<T> = ApiSuccessResponse<T[]> & {
  meta: PaginationMeta;
};

export type CursorPaginationMeta = {
  limit: number;
  nextCursor: string | null;
  previousCursor: string | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type CursorPaginatedResponse<T> = ApiSuccessResponse<T[]> & {
  meta: CursorPaginationMeta;
};

export type PaginationQuery = {
  page: number;
  limit: number;
  skip: number;
};

export type SortQuery = {
  field: string;
  order: 'asc' | 'desc';
};

export type FilterQuery = {
  search?: string;
  status?: string;
  category?: string;
};

export type CursorPaginationQuery = {
  limit: number;
  cursor?: string;
};

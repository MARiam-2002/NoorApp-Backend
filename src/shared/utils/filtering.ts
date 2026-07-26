import type { FilterQuery } from '../types/api-response';

export function parseFilterQuery(query: {
  search?: string;
  status?: string;
  category?: string;
}): FilterQuery {
  return {
    ...(query.search?.trim() && { search: query.search.trim() }),
    ...(query.status?.trim() && { status: query.status.trim() }),
    ...(query.category?.trim() && { category: query.category.trim() }),
  };
}

export function buildSearchFilter(
  search: string | undefined,
  fields: string[],
): { OR: Array<Record<string, { contains: string; mode: 'insensitive' }>> } | undefined {
  if (!search) {
    return undefined;
  }

  return {
    OR: fields.map((field) => ({
      [field]: { contains: search, mode: 'insensitive' as const },
    })),
  };
}

export function buildExactFilter(
  field: string,
  value: string | undefined,
): Record<string, string> | undefined {
  if (!value) {
    return undefined;
  }

  return { [field]: value };
}

import type { SortQuery } from '../types/api-response';
import { SortOrder } from '../enums/sort-order.enum';

export function parseSortQuery(
  sort?: string,
  allowedFields: string[] = ['createdAt', 'updatedAt'],
  defaultField = 'createdAt',
): SortQuery {
  if (!sort) {
    return { field: defaultField, order: SortOrder.Desc };
  }

  const isDescending = sort.startsWith('-');
  const field = isDescending ? sort.slice(1) : sort;

  if (!allowedFields.includes(field)) {
    return { field: defaultField, order: SortOrder.Desc };
  }

  return {
    field,
    order: isDescending ? SortOrder.Desc : SortOrder.Asc,
  };
}

export function buildOrderBy(sort: SortQuery): Record<string, 'asc' | 'desc'> {
  return { [sort.field]: sort.order };
}

export function parseMultiSortQuery(
  sort?: string | string[],
  allowedFields: string[] = ['createdAt', 'updatedAt'],
): SortQuery[] {
  const sortValues = Array.isArray(sort) ? sort : sort ? [sort] : [];

  if (sortValues.length === 0) {
    return [parseSortQuery(undefined, allowedFields)];
  }

  return sortValues.map((value) => parseSortQuery(value, allowedFields));
}

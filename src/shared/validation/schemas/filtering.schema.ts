import { z } from 'zod';

import { paginationSchema } from './pagination.schema';
import { sortingSchema } from './sorting.schema';

export const filteringSchema = z.object({
  search: z.string().trim().optional(),
  status: z.string().trim().optional(),
  category: z.string().trim().optional(),
});

export type FilteringSchema = z.infer<typeof filteringSchema>;

export const listQuerySchema = paginationSchema.merge(sortingSchema).merge(filteringSchema);

export type ListQuerySchema = z.infer<typeof listQuerySchema>;

import { z } from 'zod';

import { MAX_LIMIT } from '../../utils/pagination';

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(MAX_LIMIT).default(20),
});

export type PaginationSchema = z.infer<typeof paginationSchema>;

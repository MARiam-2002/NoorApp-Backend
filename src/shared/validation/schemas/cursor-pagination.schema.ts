import { z } from 'zod';

import { MAX_CURSOR_LIMIT } from '../../utils/cursor-pagination';

export const cursorPaginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(MAX_CURSOR_LIMIT).default(20),
  cursor: z.string().optional(),
});

export type CursorPaginationSchema = z.infer<typeof cursorPaginationSchema>;

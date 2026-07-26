import { z } from 'zod';

export const sortingSchema = z.object({
  sort: z.string().optional(),
});

export type SortingSchema = z.infer<typeof sortingSchema>;

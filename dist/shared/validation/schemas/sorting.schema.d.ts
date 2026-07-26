import { z } from 'zod';
export declare const sortingSchema: z.ZodObject<{
    sort: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type SortingSchema = z.infer<typeof sortingSchema>;
//# sourceMappingURL=sorting.schema.d.ts.map
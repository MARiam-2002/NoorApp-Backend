import { z } from 'zod';
export declare const cursorPaginationSchema: z.ZodObject<{
    limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    cursor: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CursorPaginationSchema = z.infer<typeof cursorPaginationSchema>;
//# sourceMappingURL=cursor-pagination.schema.d.ts.map
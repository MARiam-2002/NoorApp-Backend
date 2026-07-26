import { z } from 'zod';
export declare const paginationSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export type PaginationSchema = z.infer<typeof paginationSchema>;
//# sourceMappingURL=pagination.schema.d.ts.map
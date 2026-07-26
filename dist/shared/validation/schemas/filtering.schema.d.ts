import { z } from 'zod';
export declare const filteringSchema: z.ZodObject<{
    search: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type FilteringSchema = z.infer<typeof filteringSchema>;
export declare const listQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    sort: z.ZodOptional<z.ZodString>;
    search: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ListQuerySchema = z.infer<typeof listQuerySchema>;
//# sourceMappingURL=filtering.schema.d.ts.map
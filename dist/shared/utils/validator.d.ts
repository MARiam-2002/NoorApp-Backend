import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
type RequestProperty = 'body' | 'query' | 'params';
/**
 * Reusable Zod validation middleware for request data.
 */
export declare function validate<T extends ZodType>(schema: T, property?: RequestProperty): RequestHandler;
export { validate as validator };
//# sourceMappingURL=validator.d.ts.map
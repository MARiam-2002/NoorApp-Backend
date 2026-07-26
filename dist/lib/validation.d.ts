import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { z } from 'zod';
type RequestProperty = 'body' | 'query' | 'params';
export declare const passwordFieldSchema: z.ZodString;
export declare function validate<T extends ZodType>(schema: T, property?: RequestProperty): RequestHandler;
export {};
//# sourceMappingURL=validation.d.ts.map
import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { z } from 'zod';

type RequestProperty = 'body' | 'query' | 'params';

export const passwordFieldSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, 'Password must contain at least one letter and one number');

function applyValidatedData(
  req: Parameters<RequestHandler>[0],
  property: RequestProperty,
  data: unknown,
): void {
  if (property === 'body') {
    req.body = data;
    return;
  }
  Object.assign(req[property] as Record<string, unknown>, data as Record<string, unknown>);
}

export function validate<T extends ZodType>(
  schema: T,
  property: RequestProperty = 'body',
): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[property]);
    if (!result.success) {
      next(result.error);
      return;
    }
    applyValidatedData(req, property, result.data);
    next();
  };
}

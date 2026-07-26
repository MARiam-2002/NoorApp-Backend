import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

type RequestProperty = 'body' | 'query' | 'params';

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

/**
 * Reusable Zod validation middleware for request data.
 */
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

export { validate as validator };

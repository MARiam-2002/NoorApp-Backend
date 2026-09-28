import type { RequestHandler } from 'express';
import { aiConfig, ErrorCodes, HttpStatus } from '../config';
import { AppError } from '../lib/errors';

/**
 * Runs before `authenticate` on every /ai route so a disabled feature answers
 * 503 without a database lookup and without revealing which AI routes exist.
 */
export const requireAIEnabled: RequestHandler = (_req, _res, next) => {
  if (!aiConfig.enabled) {
    next(
      new AppError(
        'Noor AI is not available yet',
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCodes.AI_DISABLED,
      ),
    );
    return;
  }
  next();
};

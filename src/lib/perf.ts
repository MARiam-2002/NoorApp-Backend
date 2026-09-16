import { logger } from './logger';

/**
 * Lightweight server-side timing. Never attached to API responses.
 * Logs only when durationMs >= threshold (default 100ms) to avoid noise.
 */
export async function withPerfTiming<T>(
  op: string,
  fn: () => Promise<T>,
  thresholdMs = 100,
): Promise<T> {
  const started = Date.now();
  try {
    return await fn();
  } finally {
    const durationMs = Date.now() - started;
    if (durationMs >= thresholdMs) {
      logger.info('[perf]', { op, durationMs });
    }
  }
}

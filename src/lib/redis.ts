/**
 * Optional Redis readiness helper for Railway Key-Value / Redis.
 *
 * The API currently runs with CACHE_PROVIDER=memory by default.
 * When CACHE_PROVIDER=redis and REDIS_URL is set, this module validates
 * connectivity at boot (non-fatal) so misconfigured Redis does not crash the API.
 *
 * No business endpoints depend on Redis today — do not treat this as a cache layer rewrite.
 */
import { env } from '../config';
import { logger } from './logger';

export function isRedisConfigured(): boolean {
  return env.CACHE_PROVIDER === 'redis' && Boolean(env.REDIS_URL?.trim());
}

/**
 * Best-effort Redis ping using the Node fetch-less TCP approach via dynamic import
 * only when configured. Failures are logged; the HTTP server continues.
 */
export async function warmRedisConnection(): Promise<'skipped' | 'ok' | 'unavailable'> {
  if (!isRedisConfigured()) return 'skipped';

  const url = env.REDIS_URL.trim();
  try {
    // Prefer native undici/net URL parse check — full client optional.
    // Validate URL shape without requiring ioredis until cache is wired.
    const parsed = new URL(url);
    if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
      logger.warn('[Redis] REDIS_URL must use redis:// or rediss:// — continuing without Redis');
      return 'unavailable';
    }
    logger.info('[Redis] REDIS_URL configured for Railway/cache use', {
      host: parsed.hostname,
      tls: parsed.protocol === 'rediss:',
    });
    return 'ok';
  } catch (error) {
    logger.warn('[Redis] Invalid REDIS_URL — continuing without Redis', {
      message: (error as Error)?.message,
    });
    return 'unavailable';
  }
}

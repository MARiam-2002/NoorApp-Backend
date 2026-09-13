import { logger } from './logger';

/**
 * In-process cooldown for upstream content providers (QUL CDN, Quran Foundation).
 * Prevents hammering a rate-limited provider; never exposes raw 429 details to clients.
 */

type CooldownState = {
  untilMs: number;
  consecutive: number;
};

const cooldowns = new Map<string, CooldownState>();

export const PROVIDER_KEYS = {
  QUL_QURTUBI: 'qul_qurtubi',
  QURAN_FOUNDATION: 'quran_foundation',
} as const;

function parseRetryAfterSeconds(header: string | null | undefined): number | null {
  if (header == null || header === '') return null;
  const asInt = Number(header);
  if (Number.isFinite(asInt) && asInt >= 0) return Math.min(300, Math.max(1, Math.ceil(asInt)));
  const asDate = Date.parse(header);
  if (!Number.isNaN(asDate)) {
    const sec = Math.ceil((asDate - Date.now()) / 1000);
    if (sec > 0) return Math.min(300, sec);
  }
  return null;
}

function exponentialBackoffSeconds(consecutive: number): number {
  // 2, 4, 8, 16, 32, capped at 60
  return Math.min(60, 2 ** Math.min(Math.max(consecutive, 1), 5));
}

export function isProviderCoolingDown(providerKey: string): boolean {
  const state = cooldowns.get(providerKey);
  return Boolean(state && state.untilMs > Date.now());
}

export function getProviderCooldownRemainingMs(providerKey: string): number {
  const state = cooldowns.get(providerKey);
  if (!state) return 0;
  return Math.max(0, state.untilMs - Date.now());
}

/** Mark provider rate-limited; returns cooldown seconds applied. */
export function markProviderRateLimited(
  providerKey: string,
  retryAfterHeader?: string | null,
): number {
  const prev = cooldowns.get(providerKey);
  const consecutive = (prev?.consecutive ?? 0) + 1;
  const fromHeader = parseRetryAfterSeconds(retryAfterHeader);
  const seconds = fromHeader ?? exponentialBackoffSeconds(consecutive);
  const untilMs = Date.now() + seconds * 1000;
  cooldowns.set(providerKey, { untilMs, consecutive });
  logger.warn('[ProviderCooldown] rate-limited; cooling down', {
    providerKey,
    seconds,
    consecutive,
    usedRetryAfter: fromHeader != null,
  });
  return seconds;
}

export function clearProviderCooldown(providerKey: string): void {
  if (cooldowns.has(providerKey)) cooldowns.delete(providerKey);
}

/** Test/helper: reset all cooldowns (not used in production request path). */
export function resetAllProviderCooldowns(): void {
  cooldowns.clear();
}

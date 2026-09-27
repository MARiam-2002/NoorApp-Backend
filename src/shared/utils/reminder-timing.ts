/**
 * Server-side FCM reminder timing (backup to Flutter local alarms).
 *
 * Rule: a reminder is NEVER sent before its local HH:mm. It is due from the
 * target minute up to `lateToleranceMinutes` after it. The in-process scheduler
 * ticks every minute, so real-world lateness is < 1 minute; the tolerance only
 * matters when a tick is missed (deploy/restart) and the 10-minute Railway cron
 * has to catch up.
 */

/** Must be >= the external Railway cron interval (every 10 minutes). */
export const REMINDER_LATE_TOLERANCE_MINUTES = 10;

/** Pre-prayer ("in 15 minutes") may slip at most this fraction of its lead time. */
const PRE_REMINDER_MAX_SLIP_RATIO = 0.5;

/** FCM time-to-live: an expired reminder is dropped instead of arriving hours later. */
export const PUSH_TTL_SECONDS = {
  AZAN: 15 * 60,
  SCHEDULED_REMINDER: 60 * 60,
  SALAWAT: 30 * 60,
} as const;

export function isDueAtLocalMinute(
  minutesPastTarget: number,
  lateToleranceMinutes: number = REMINDER_LATE_TOLERANCE_MINUTES,
): boolean {
  if (!Number.isFinite(minutesPastTarget)) return false;
  return minutesPastTarget >= 0 && minutesPastTarget <= Math.max(0, lateToleranceMinutes);
}

/**
 * Pre-reminder is due when `minutesUntilPrayer` has reached `pre`, allowing a
 * bounded slip (so "in 15 minutes" never arrives 1 minute before the Azan).
 */
export function isPreReminderDue(
  minutesUntilPrayer: number,
  preReminderMinutes: number,
  lateToleranceMinutes: number = REMINDER_LATE_TOLERANCE_MINUTES,
): boolean {
  const pre = Math.max(0, Math.floor(Number(preReminderMinutes) || 0));
  if (pre <= 0 || !Number.isFinite(minutesUntilPrayer) || minutesUntilPrayer < 1) return false;
  const maxSlip = Math.min(
    Math.max(0, lateToleranceMinutes),
    Math.floor(pre * PRE_REMINDER_MAX_SLIP_RATIO),
  );
  const slip = pre - minutesUntilPrayer;
  return slip >= 0 && slip <= maxSlip;
}

/** A buggy far-future `localScheduledUntil` must not silence the backup forever. */
const MAX_LOCAL_COVERAGE_MS = 16 * 24 * 60 * 60 * 1000;

/**
 * Epoch ms up to which the app reported local notifications as scheduled.
 * Returns -Infinity when there is no (valid) coverage, so every occurrence
 * falls back to server FCM.
 */
export function localCoverageUntilMs(
  localScheduledUntil: string | null | undefined,
  nowMs: number = Date.now(),
): number {
  if (!localScheduledUntil) return Number.NEGATIVE_INFINITY;
  const ms = Date.parse(localScheduledUntil);
  if (!Number.isFinite(ms)) return Number.NEGATIVE_INFINITY;
  return Math.min(ms, nowMs + MAX_LOCAL_COVERAGE_MS);
}

export function preReminderTtlSeconds(minutesUntilPrayer: number): number {
  const mins = Number.isFinite(minutesUntilPrayer) ? minutesUntilPrayer : 0;
  return Math.max(60, Math.floor(mins * 60));
}

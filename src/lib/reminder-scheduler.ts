import { appConfig, env } from '../config';
import { logger } from './logger';
import { runPrayerReminderCron } from '../services/prayer-reminder.service';
import { pruneOldNotifications } from '../services/notification.service';

const PRUNE_EVERY_MS = 24 * 60 * 60 * 1000;
let lastPruneAt = 0;

/** Fire shortly after each wall-clock minute so the local HH:mm has already rolled over. */
const TICK_OFFSET_MS = 1_500;

let timer: NodeJS.Timeout | null = null;
let stopped = true;

export function isReminderSchedulerEnabled(): boolean {
  const flag = env.REMINDER_SCHEDULER_ENABLED;
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return appConfig.isProduction;
}

function msUntilNextTick(nowMs = Date.now()): number {
  return 60_000 - (nowMs % 60_000) + TICK_OFFSET_MS;
}

function scheduleNext(): void {
  if (stopped) return;
  timer = setTimeout(tick, msUntilNextTick());
  timer.unref();
}

async function tick(): Promise<void> {
  try {
    await runPrayerReminderCron('scheduler');
  } catch (err) {
    logger.error('[ReminderScheduler] tick failed', {
      message: (err as Error)?.message,
    });
  } finally {
    if (Date.now() - lastPruneAt >= PRUNE_EVERY_MS) {
      lastPruneAt = Date.now();
      pruneOldNotifications()
        .then(r => logger.info('[ReminderScheduler] old notifications pruned', r))
        .catch(err => logger.warn('[ReminderScheduler] prune failed', { message: (err as Error)?.message }));
    }
    scheduleNext();
  }
}

export function startReminderScheduler(): void {
  if (!stopped) return;
  if (!isReminderSchedulerEnabled()) {
    logger.info('[ReminderScheduler] disabled', {
      REMINDER_SCHEDULER_ENABLED: env.REMINDER_SCHEDULER_ENABLED,
    });
    return;
  }
  stopped = false;
  scheduleNext();
  logger.info('[ReminderScheduler] started (every minute)');
}

export function stopReminderScheduler(): void {
  stopped = true;
  if (timer) clearTimeout(timer);
  timer = null;
}

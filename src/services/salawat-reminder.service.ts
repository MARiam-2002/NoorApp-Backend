import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import { DefaultTimezone } from '../utils/constants';
import { sendPushToUser } from './device.service';
import { createNotification } from './notification.service';

/** Interval between salawat reminders. */
export const SALAWAT_INTERVAL_HOURS = 3;
/** Cap per local calendar day. */
export const SALAWAT_MAX_PER_DAY = 5;
/** Quiet hours in local time: [22:00, 08:00). */
export const SALAWAT_QUIET_START_HOUR = 22;
export const SALAWAT_QUIET_END_HOUR = 8;

const SALAWAT_TITLE_AR = 'الصلاة على النبي ﷺ';
const SALAWAT_TITLE_EN = 'Pray for the Prophet ﷺ';
const SALAWAT_BODY_AR = 'اللهم صل وسلم على نبينا محمد ﷺ';
const SALAWAT_BODY_EN = 'O Allah, send blessings and peace upon our Prophet Muhammad ﷺ';

export type LocalClock = {
  hour: number;
  minute: number;
  /** Local calendar day key YYYY-MM-DD */
  dayKey: string;
};

export function resolveTimezone(timezone?: string | null): string {
  const candidate = timezone?.trim() || DefaultTimezone;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DefaultTimezone;
  }
}

export function getLocalClock(now: Date, timeZone: string): LocalClock {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  const year = pick('year');
  const month = pick('month');
  const day = pick('day');
  return {
    hour: Number(pick('hour')),
    minute: Number(pick('minute')),
    dayKey: `${year}-${month}-${day}`,
  };
}

export function isInQuietHours(
  hour: number,
  quietStart = SALAWAT_QUIET_START_HOUR,
  quietEnd = SALAWAT_QUIET_END_HOUR,
): boolean {
  // 22:00–23:59 and 00:00–07:59
  return hour >= quietStart || hour < quietEnd;
}

export function localDayKeyForInstant(instant: Date, timeZone: string): string {
  return getLocalClock(instant, timeZone).dayKey;
}

export type SalawatEligibility = {
  eligible: boolean;
  reason?:
    | 'DISABLED'
    | 'QUIET_HOURS'
    | 'MAX_PER_DAY'
    | 'TOO_SOON'
    | 'OK';
  sentToday: number;
  hoursSinceLast: number | null;
};

/**
 * Pure eligibility check (used by cron + unit tests).
 */
export function evaluateSalawatEligibility(input: {
  enabled: boolean;
  now: Date;
  timeZone: string;
  recentSentAt: Date[];
}): SalawatEligibility {
  if (!input.enabled) {
    return { eligible: false, reason: 'DISABLED', sentToday: 0, hoursSinceLast: null };
  }

  const clock = getLocalClock(input.now, input.timeZone);
  if (isInQuietHours(clock.hour)) {
    return { eligible: false, reason: 'QUIET_HOURS', sentToday: 0, hoursSinceLast: null };
  }

  const todaySends = input.recentSentAt.filter(
    (at) => localDayKeyForInstant(at, input.timeZone) === clock.dayKey,
  );
  const sentToday = todaySends.length;
  if (sentToday >= SALAWAT_MAX_PER_DAY) {
    return { eligible: false, reason: 'MAX_PER_DAY', sentToday, hoursSinceLast: null };
  }

  const lastAt = input.recentSentAt.reduce<Date | null>((latest, at) => {
    if (!latest || at.getTime() > latest.getTime()) return at;
    return latest;
  }, null);

  const hoursSinceLast =
    lastAt == null ? null : (input.now.getTime() - lastAt.getTime()) / (60 * 60 * 1000);

  if (hoursSinceLast != null && hoursSinceLast < SALAWAT_INTERVAL_HOURS) {
    return { eligible: false, reason: 'TOO_SOON', sentToday, hoursSinceLast };
  }

  return { eligible: true, reason: 'OK', sentToday, hoursSinceLast };
}

export async function getSalawatPreferences(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { salawatReminderEnabled: true },
  });
  if (!user) {
    throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }
  return {
    enabled: Boolean(user.salawatReminderEnabled),
    intervalHours: SALAWAT_INTERVAL_HOURS,
    maxPerDay: SALAWAT_MAX_PER_DAY,
    quietHoursStart: `${String(SALAWAT_QUIET_START_HOUR).padStart(2, '0')}:00`,
    quietHoursEnd: `${String(SALAWAT_QUIET_END_HOUR).padStart(2, '0')}:00`,
  };
}

export async function updateSalawatPreferences(userId: string, enabled: boolean) {
  await prisma.user.update({
    where: { id: userId },
    data: { salawatReminderEnabled: enabled },
  });
  return getSalawatPreferences(userId);
}

/**
 * Cron slice: send "Pray for the Prophet ﷺ" when eligible.
 * Independent of Azan preferences / location.
 */
export async function runSalawatReminders(now = new Date()): Promise<{
  usersScanned: number;
  pushesAttempted: number;
  pushesSent: number;
  skipped: Record<string, number>;
}> {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      salawatReminderEnabled: true,
      deviceTokens: { some: {} },
    },
    select: { id: true, timezone: true, salawatReminderEnabled: true },
    take: 500,
  });

  let pushesAttempted = 0;
  let pushesSent = 0;
  const skipped: Record<string, number> = {};

  // Look back enough for max/day + interval (2 local days)
  const lookback = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  for (const user of users) {
    try {
      const timeZone = resolveTimezone(user.timezone);
      const recentRows = await prisma.notification.findMany({
        where: {
          userId: user.id,
          type: 'SALAWAT' as any,
          createdAt: { gte: lookback },
        },
        select: { createdAt: true, payload: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      const recentSentAt = recentRows.map((r) => r.createdAt);
      const decision = evaluateSalawatEligibility({
        enabled: user.salawatReminderEnabled,
        now,
        timeZone,
        recentSentAt,
      });

      if (!decision.eligible) {
        const key = decision.reason ?? 'SKIP';
        skipped[key] = (skipped[key] ?? 0) + 1;
        continue;
      }

      pushesAttempted += 1;
      const result = await sendPushToUser(user.id, {
        title: SALAWAT_TITLE_EN,
        body: SALAWAT_BODY_EN,
        titleAr: SALAWAT_TITLE_AR,
        bodyAr: SALAWAT_BODY_AR,
        data: {
          type: 'SALAWAT',
          kind: 'salawat_reminder',
        },
      });
      pushesSent += result.sent;

      await createNotification({
        userId: user.id,
        titleAr: SALAWAT_TITLE_AR,
        titleEn: SALAWAT_TITLE_EN,
        bodyAr: SALAWAT_BODY_AR,
        bodyEn: SALAWAT_BODY_EN,
        type: 'SALAWAT' as any,
        deepLink: '/tasbih',
        payload: {
          type: 'SALAWAT',
          kind: 'salawat_reminder',
          dayKey: getLocalClock(now, timeZone).dayKey,
        },
      }).catch(() => null);
    } catch (err) {
      logger.warn('[Cron] Salawat reminder failed for user', {
        userId: user.id,
        message: (err as Error)?.message,
      });
    }
  }

  return {
    usersScanned: users.length,
    pushesAttempted,
    pushesSent,
    skipped,
  };
}

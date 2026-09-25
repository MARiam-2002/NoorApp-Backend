import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import { sendPushToUser } from './device.service';
import { createNotification } from './notification.service';
import {
  getLocalClock,
  parseHhmm,
  normalizeHhmm,
  resolveTimezone,
} from './salawat-reminder.service';

/** Default local bedtime reminder (8 PM). */
export const MULK_DEFAULT_TIME = '20:00';
/** Cron window (± minutes) around mulkReminderTime — matches ~10m prayer cron cadence. */
export const MULK_WINDOW_MINUTES = 12;
/** Quran surah number for deep link. */
export const MULK_SURAH_ID = 67;

const MULK_TITLE_AR = 'سورة الملك';
const MULK_TITLE_EN = 'Surah Al-Mulk';
const MULK_BODY_AR = 'لا تنس قراءة سورة الملك';
const MULK_BODY_EN = "Don't forget to read Surah Al-Mulk";
const MULK_DEEP_LINK = `/quran/surah/${MULK_SURAH_ID}`;

export type MulkPreferencesDto = {
  enabled: boolean;
  /** Local HH:mm (default 20:00). */
  time: string;
  surahId: number;
  deepLink: string;
  titleAr: string;
  bodyAr: string;
  titleEn: string;
  bodyEn: string;
};

export type MulkEligibility = {
  eligible: boolean;
  reason?: 'DISABLED' | 'OUTSIDE_WINDOW' | 'OK';
  occurrenceKey: string | null;
  dayKey: string | null;
  minutesFromTarget: number | null;
};

export function occurrenceKey(dayKey: string, time: string): string {
  return `${dayKey}|MULK|${time}`;
}

/**
 * True when local clock is within ±windowMinutes of target HH:mm.
 * Does not wrap midnight (20:00 ±12 stays evening-only).
 */
export function evaluateMulkEligibility(input: {
  enabled: boolean;
  now: Date;
  timeZone: string;
  reminderTime?: string;
  windowMinutes?: number;
}): MulkEligibility {
  const time = normalizeHhmm(input.reminderTime, MULK_DEFAULT_TIME);
  const window = Math.max(1, input.windowMinutes ?? MULK_WINDOW_MINUTES);
  const clock = getLocalClock(input.now, input.timeZone);
  const target = parseHhmm(time);
  if (!target) {
    return {
      eligible: false,
      reason: 'OUTSIDE_WINDOW',
      occurrenceKey: null,
      dayKey: clock.dayKey,
      minutesFromTarget: null,
    };
  }

  const key = occurrenceKey(clock.dayKey, time);
  if (!input.enabled) {
    return {
      eligible: false,
      reason: 'DISABLED',
      occurrenceKey: key,
      dayKey: clock.dayKey,
      minutesFromTarget: null,
    };
  }

  const nowMinutes = clock.hour * 60 + clock.minute;
  const minutesFromTarget = Math.abs(nowMinutes - target.total);
  if (minutesFromTarget > window) {
    return {
      eligible: false,
      reason: 'OUTSIDE_WINDOW',
      occurrenceKey: key,
      dayKey: clock.dayKey,
      minutesFromTarget,
    };
  }

  return {
    eligible: true,
    reason: 'OK',
    occurrenceKey: key,
    dayKey: clock.dayKey,
    minutesFromTarget,
  };
}

function toDto(row: {
  mulkReminderEnabled: boolean;
  mulkReminderTime: string;
}): MulkPreferencesDto {
  return {
    enabled: Boolean(row.mulkReminderEnabled),
    time: normalizeHhmm(row.mulkReminderTime, MULK_DEFAULT_TIME),
    surahId: MULK_SURAH_ID,
    deepLink: MULK_DEEP_LINK,
    titleAr: MULK_TITLE_AR,
    bodyAr: MULK_BODY_AR,
    titleEn: MULK_TITLE_EN,
    bodyEn: MULK_BODY_EN,
  };
}

export async function getMulkPreferences(userId: string): Promise<MulkPreferencesDto> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      mulkReminderEnabled: true,
      mulkReminderTime: true,
    },
  });
  if (!user) {
    throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }
  return toDto(user);
}

export async function updateMulkPreferences(
  userId: string,
  patch: { enabled?: boolean; time?: string },
): Promise<MulkPreferencesDto> {
  const data: {
    mulkReminderEnabled?: boolean;
    mulkReminderTime?: string;
  } = {};

  if (typeof patch.enabled === 'boolean') {
    data.mulkReminderEnabled = patch.enabled;
  }
  if (patch.time != null) {
    const parsed = parseHhmm(patch.time);
    if (!parsed) {
      throw new AppError('time must be HH:mm', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }
    data.mulkReminderTime = patch.time;
  }

  if (Object.keys(data).length === 0) {
    throw new AppError('No preference fields to update', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
  }

  await prisma.user.update({
    where: { id: userId },
    data,
  });
  return getMulkPreferences(userId);
}

async function claimOccurrence(userId: string, key: string): Promise<boolean> {
  try {
    await prisma.mulkSendLog.create({
      data: { userId, occurrenceKey: key },
    });
    return true;
  } catch (err: any) {
    if (err?.code === 'P2002') return false;
    throw err;
  }
}

/**
 * Cron slice: one FCM + in-app notification per user per local day at mulkReminderTime (±window).
 * Preference-gated, user-local timezone, durable occurrence de-dupe.
 */
export async function runMulkReminders(
  now = new Date(),
  windowMinutes = MULK_WINDOW_MINUTES,
): Promise<{
  usersScanned: number;
  pushesAttempted: number;
  pushesSent: number;
  skipped: Record<string, number>;
}> {
  let usersScanned = 0;
  let pushesAttempted = 0;
  let pushesSent = 0;
  const skipped: Record<string, number> = {};

  let cursor: string | undefined;
  for (;;) {
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        mulkReminderEnabled: true,
        deviceTokens: { some: {} },
      },
      select: {
        id: true,
        timezone: true,
        mulkReminderEnabled: true,
        mulkReminderTime: true,
      },
      take: 200,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    });
    if (users.length === 0) break;
    cursor = users[users.length - 1]?.id;
    usersScanned += users.length;

    for (const user of users) {
      try {
        const timeZone = resolveTimezone(user.timezone);
        const reminderTime = normalizeHhmm(user.mulkReminderTime, MULK_DEFAULT_TIME);
        const decision = evaluateMulkEligibility({
          enabled: user.mulkReminderEnabled,
          now,
          timeZone,
          reminderTime,
          windowMinutes,
        });

        if (!decision.eligible || !decision.occurrenceKey || !decision.dayKey) {
          const key = decision.reason ?? 'SKIP';
          skipped[key] = (skipped[key] ?? 0) + 1;
          continue;
        }

        const claimed = await claimOccurrence(user.id, decision.occurrenceKey);
        if (!claimed) {
          skipped.DUPLICATE = (skipped.DUPLICATE ?? 0) + 1;
          continue;
        }

        const dayKey = decision.dayKey;
        const dedupeKey = `${dayKey}|${user.id}|MULK|MULK|${decision.occurrenceKey}`;

        const fcmData: Record<string, string> = {
          type: 'MULK',
          kind: 'mulk_reminder',
          eventType: 'MULK',
          eventKey: 'MULK',
          soundType: 'MULK',
          androidChannelId: 'mulk',
          source: 'FCM_BACKUP',
          locale: 'ar',
          timezone: timeZone,
          dayKey,
          reminderTime,
          occurrenceKey: decision.occurrenceKey,
          dedupeKey,
          surahId: String(MULK_SURAH_ID),
          deepLink: MULK_DEEP_LINK,
          titleAr: MULK_TITLE_AR,
          bodyAr: MULK_BODY_AR,
          titleEn: MULK_TITLE_EN,
          bodyEn: MULK_BODY_EN,
        };

        pushesAttempted += 1;
        const result = await sendPushToUser(user.id, {
          title: MULK_TITLE_AR,
          body: MULK_BODY_AR,
          titleAr: MULK_TITLE_AR,
          bodyAr: MULK_BODY_AR,
          data: fcmData,
          androidChannelId: 'mulk',
        });
        pushesSent += result.sent;

        await createNotification({
          userId: user.id,
          titleAr: MULK_TITLE_AR,
          titleEn: MULK_TITLE_EN,
          bodyAr: MULK_BODY_AR,
          bodyEn: MULK_BODY_EN,
          type: 'MULK' as any,
          deepLink: MULK_DEEP_LINK,
          payload: {
            type: 'MULK',
            kind: 'mulk_reminder',
            eventType: 'MULK',
            eventKey: 'MULK',
            soundType: 'MULK',
            dayKey,
            reminderTime,
            occurrenceKey: decision.occurrenceKey,
            dedupeKey,
            surahId: MULK_SURAH_ID,
            deepLink: MULK_DEEP_LINK,
          },
        }).catch(() => null);
      } catch (err) {
        logger.warn('[Cron] Mulk reminder failed for user', {
          userId: user.id,
          message: (err as Error)?.message,
        });
        skipped.ERROR = (skipped.ERROR ?? 0) + 1;
      }
    }

    if (users.length < 200) break;
  }

  return {
    usersScanned,
    pushesAttempted,
    pushesSent,
    skipped,
  };
}

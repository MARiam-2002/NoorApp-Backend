import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import { DefaultTimezone } from '../utils/constants';
import { sendPushToUser } from './device.service';
import { createNotification } from './notification.service';
import { resolveReminderAudioClip, getSalawatAudioClipById } from './salawat-audio.service';
import {
  resolveSalawatAudioClipId,
  DEFAULT_SALAWAT_AUDIO_ID,
  DEFAULT_SALAWAT_NATIVE_SOUND,
  DEFAULT_SALAWAT_MEDIA_FILE,
} from '../shared/constants/salawat-audio';

/** Legacy default interval (hours) — maps to intervalMinutes 180. */
export const SALAWAT_INTERVAL_HOURS = 3;
export const SALAWAT_ALLOWED_INTERVALS = [30, 60, 120, 180] as const;
export type SalawatIntervalMinutes = (typeof SALAWAT_ALLOWED_INTERVALS)[number];

/** Safety cap per local calendar day (also bounded by window / interval). */
export const SALAWAT_MAX_PER_DAY_CAP = 48;

/** Legacy quiet-hour constants (complement of default 08:00–22:00 window). */
export const SALAWAT_QUIET_START_HOUR = 22;
export const SALAWAT_QUIET_END_HOUR = 8;

export const SALAWAT_DEFAULT_INTERVAL_MINUTES: SalawatIntervalMinutes = 180;
export const SALAWAT_DEFAULT_START = '08:00';
export const SALAWAT_DEFAULT_END = '22:00';

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const SALAWAT_TITLE_AR = 'صلِّ على محمد ﷺ';
const SALAWAT_TITLE_EN = 'Send blessings upon Muhammad ﷺ';
const SALAWAT_BODY_AR = 'تذكير: صلِّ على النبي محمد ﷺ';
const SALAWAT_BODY_EN = 'Reminder: send blessings upon the Prophet ﷺ';

export type LocalClock = {
  hour: number;
  minute: number;
  /** Local calendar day key YYYY-MM-DD */
  dayKey: string;
};

export type SalawatPreferencesDto = {
  enabled: boolean;
  intervalMinutes: SalawatIntervalMinutes;
  startTime: string;
  endTime: string;
  /** Additive alias of startTime (screenshot / some Flutter drafts). */
  windowStart: string;
  /** Additive alias of endTime. */
  windowEnd: string;
  /** Kept for existing Flutter clients (intervalMinutes / 60). */
  intervalHours: number;
  maxPerDay: number;
  /** Quiet window start = active end (legacy field). */
  quietHoursStart: string;
  /** Quiet window end = active start (legacy field). */
  quietHoursEnd: string;
  /** Selected catalog clip (picker). Additive. */
  audioClipId: string;
  /** Convenience for Flutter UI — always the Noor "صلِّ على محمد" voice when default. */
  audioClipTitleAr: string;
  audioClipCreatorAr: string;
  mediaFile: string;
  /** Basename for local/FCM channel sound (no .mp3). */
  nativeSound: string;
  audioUrl: string | null;
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

export function parseHhmm(value: string): { hour: number; minute: number; total: number } | null {
  if (!HHMM_RE.test(value)) return null;
  const [hRaw, mRaw] = value.split(':');
  const hour = Number(hRaw);
  const minute = Number(mRaw);
  return { hour, minute, total: hour * 60 + minute };
}

export function normalizeIntervalMinutes(value: unknown): SalawatIntervalMinutes {
  const n = typeof value === 'number' ? value : Number(value);
  if ((SALAWAT_ALLOWED_INTERVALS as readonly number[]).includes(n)) {
    return n as SalawatIntervalMinutes;
  }
  return SALAWAT_DEFAULT_INTERVAL_MINUTES;
}

export function normalizeHhmm(value: unknown, fallback: string): string {
  if (typeof value === 'string' && parseHhmm(value)) return value;
  return fallback;
}

/**
 * Active window in local minutes-from-midnight.
 * start === end → treat as 24h (always active).
 * start < end → same-day window.
 * start > end → overnight window.
 */
export function isWithinActiveWindow(
  minutesFromMidnight: number,
  startTime: string,
  endTime: string,
): boolean {
  const start = parseHhmm(startTime)?.total;
  const end = parseHhmm(endTime)?.total;
  if (start == null || end == null) return false;
  if (start === end) return true;
  if (start < end) {
    return minutesFromMidnight >= start && minutesFromMidnight < end;
  }
  return minutesFromMidnight >= start || minutesFromMidnight < end;
}

export function activeWindowMinutes(startTime: string, endTime: string): number {
  const start = parseHhmm(startTime)?.total;
  const end = parseHhmm(endTime)?.total;
  if (start == null || end == null) return 14 * 60;
  if (start === end) return 24 * 60;
  if (start < end) return end - start;
  return 24 * 60 - start + end;
}

export function computeMaxPerDay(intervalMinutes: number, startTime: string, endTime: string): number {
  const window = activeWindowMinutes(startTime, endTime);
  const raw = Math.floor(window / Math.max(1, intervalMinutes));
  return Math.min(SALAWAT_MAX_PER_DAY_CAP, Math.max(1, raw));
}

/** Legacy helper: default window is quiet 22:00–08:00. */
export function isInQuietHours(
  hour: number,
  quietStart = SALAWAT_QUIET_START_HOUR,
  quietEnd = SALAWAT_QUIET_END_HOUR,
): boolean {
  return hour >= quietStart || hour < quietEnd;
}

export function localDayKeyForInstant(instant: Date, timeZone: string): string {
  return getLocalClock(instant, timeZone).dayKey;
}

export function occurrenceKey(dayKey: string, minutesFromMidnight: number, intervalMinutes: number): string {
  const slot = Math.floor(minutesFromMidnight / Math.max(1, intervalMinutes));
  return `${dayKey}|${intervalMinutes}|${slot}`;
}

export type SalawatEligibility = {
  eligible: boolean;
  reason?: 'DISABLED' | 'OUTSIDE_WINDOW' | 'QUIET_HOURS' | 'MAX_PER_DAY' | 'TOO_SOON' | 'OK';
  sentToday: number;
  minutesSinceLast: number | null;
  hoursSinceLast: number | null;
  occurrenceKey: string | null;
};

export function evaluateSalawatEligibility(input: {
  enabled: boolean;
  now: Date;
  timeZone: string;
  recentSentAt: Date[];
  intervalMinutes?: number;
  startTime?: string;
  endTime?: string;
}): SalawatEligibility {
  const intervalMinutes = normalizeIntervalMinutes(input.intervalMinutes ?? SALAWAT_DEFAULT_INTERVAL_MINUTES);
  const startTime = normalizeHhmm(input.startTime, SALAWAT_DEFAULT_START);
  const endTime = normalizeHhmm(input.endTime, SALAWAT_DEFAULT_END);

  if (!input.enabled) {
    return {
      eligible: false,
      reason: 'DISABLED',
      sentToday: 0,
      minutesSinceLast: null,
      hoursSinceLast: null,
      occurrenceKey: null,
    };
  }

  const clock = getLocalClock(input.now, input.timeZone);
  const minutesFromMidnight = clock.hour * 60 + clock.minute;
  const key = occurrenceKey(clock.dayKey, minutesFromMidnight, intervalMinutes);

  if (!isWithinActiveWindow(minutesFromMidnight, startTime, endTime)) {
    return {
      eligible: false,
      reason: 'OUTSIDE_WINDOW',
      sentToday: 0,
      minutesSinceLast: null,
      hoursSinceLast: null,
      occurrenceKey: key,
    };
  }

  const todaySends = input.recentSentAt.filter(
    (at) => localDayKeyForInstant(at, input.timeZone) === clock.dayKey,
  );
  const sentToday = todaySends.length;
  const maxPerDay = computeMaxPerDay(intervalMinutes, startTime, endTime);
  if (sentToday >= maxPerDay) {
    return {
      eligible: false,
      reason: 'MAX_PER_DAY',
      sentToday,
      minutesSinceLast: null,
      hoursSinceLast: null,
      occurrenceKey: key,
    };
  }

  const lastAt = input.recentSentAt.reduce<Date | null>((latest, at) => {
    if (!latest || at.getTime() > latest.getTime()) return at;
    return latest;
  }, null);

  const minutesSinceLast =
    lastAt == null ? null : (input.now.getTime() - lastAt.getTime()) / 60_000;
  const hoursSinceLast = minutesSinceLast == null ? null : minutesSinceLast / 60;

  if (minutesSinceLast != null && minutesSinceLast < intervalMinutes) {
    return {
      eligible: false,
      reason: 'TOO_SOON',
      sentToday,
      minutesSinceLast,
      hoursSinceLast,
      occurrenceKey: key,
    };
  }

  return {
    eligible: true,
    reason: 'OK',
    sentToday,
    minutesSinceLast,
    hoursSinceLast,
    occurrenceKey: key,
  };
}

function toDto(row: {
  salawatReminderEnabled: boolean;
  salawatIntervalMinutes: number;
  salawatWindowStart: string;
  salawatWindowEnd: string;
  salawatAudioClipId?: string | null;
}): SalawatPreferencesDto {
  const intervalMinutes = normalizeIntervalMinutes(row.salawatIntervalMinutes);
  const startTime = normalizeHhmm(row.salawatWindowStart, SALAWAT_DEFAULT_START);
  const endTime = normalizeHhmm(row.salawatWindowEnd, SALAWAT_DEFAULT_END);
  const audioClipId = resolveSalawatAudioClipId(row.salawatAudioClipId);
  const clip = getSalawatAudioClipById(audioClipId);
  return {
    enabled: Boolean(row.salawatReminderEnabled),
    intervalMinutes,
    startTime,
    endTime,
    windowStart: startTime,
    windowEnd: endTime,
    intervalHours: intervalMinutes / 60,
    maxPerDay: computeMaxPerDay(intervalMinutes, startTime, endTime),
    quietHoursStart: endTime,
    quietHoursEnd: startTime,
    audioClipId,
    audioClipTitleAr: clip.titleAr || 'صلِّ على محمد',
    audioClipCreatorAr: clip.creatorAr || 'نور',
    mediaFile: clip.mediaFile || DEFAULT_SALAWAT_MEDIA_FILE,
    nativeSound: DEFAULT_SALAWAT_NATIVE_SOUND,
    audioUrl: clip.audioUrl,
  };
}

export async function getSalawatPreferences(userId: string): Promise<SalawatPreferencesDto> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      salawatReminderEnabled: true,
      salawatIntervalMinutes: true,
      salawatWindowStart: true,
      salawatWindowEnd: true,
      salawatAudioClipId: true,
    },
  });
  if (!user) {
    throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }
  return toDto(user);
}

export async function updateSalawatPreferences(
  userId: string,
  patch: {
    enabled?: boolean;
    intervalMinutes?: number;
    startTime?: string;
    endTime?: string;
    windowStart?: string;
    windowEnd?: string;
    audioClipId?: string;
  },
): Promise<SalawatPreferencesDto> {
  const data: {
    salawatReminderEnabled?: boolean;
    salawatIntervalMinutes?: number;
    salawatWindowStart?: string;
    salawatWindowEnd?: string;
    salawatAudioClipId?: string;
  } = {};

  if (typeof patch.enabled === 'boolean') {
    data.salawatReminderEnabled = patch.enabled;
  }
  if (patch.intervalMinutes != null) {
    data.salawatIntervalMinutes = normalizeIntervalMinutes(patch.intervalMinutes);
  }
  const startTime = patch.startTime ?? patch.windowStart;
  const endTime = patch.endTime ?? patch.windowEnd;
  if (startTime != null) {
    const parsed = parseHhmm(startTime);
    if (!parsed) {
      throw new AppError('startTime must be HH:mm', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }
    data.salawatWindowStart = startTime;
  }
  if (endTime != null) {
    const parsed = parseHhmm(endTime);
    if (!parsed) {
      throw new AppError('endTime must be HH:mm', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }
    data.salawatWindowEnd = endTime;
  }
  if (patch.audioClipId != null) {
    data.salawatAudioClipId = resolveSalawatAudioClipId(patch.audioClipId);
  }

  if (Object.keys(data).length === 0) {
    throw new AppError('No preference fields to update', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
  }

  await prisma.user.update({
    where: { id: userId },
    data,
  });
  return getSalawatPreferences(userId);
}

async function claimOccurrence(userId: string, key: string): Promise<boolean> {
  try {
    await prisma.salawatSendLog.create({
      data: { userId, occurrenceKey: key },
    });
    return true;
  } catch (err: any) {
    if (err?.code === 'P2002') return false;
    throw err;
  }
}

/**
 * Cron slice: FCM + in-app notification when eligible.
 * Preference-gated, user-local timezone, durable occurrence de-dupe.
 */
export async function runSalawatReminders(now = new Date()): Promise<{
  usersScanned: number;
  pushesAttempted: number;
  pushesSent: number;
  skipped: Record<string, number>;
}> {
  let usersScanned = 0;
  let pushesAttempted = 0;
  let pushesSent = 0;
  const skipped: Record<string, number> = {};
  const lookback = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  let cursor: string | undefined;
  for (;;) {
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        salawatReminderEnabled: true,
        deviceTokens: { some: {} },
      },
      select: {
        id: true,
        timezone: true,
        salawatReminderEnabled: true,
        salawatIntervalMinutes: true,
        salawatWindowStart: true,
        salawatWindowEnd: true,
        salawatAudioClipId: true,
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
        const recentRows = await prisma.notification.findMany({
          where: {
            userId: user.id,
            type: 'SALAWAT' as any,
            createdAt: { gte: lookback },
          },
          select: { createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 60,
        });

        const decision = evaluateSalawatEligibility({
          enabled: user.salawatReminderEnabled,
          now,
          timeZone,
          recentSentAt: recentRows.map((r) => r.createdAt),
          intervalMinutes: user.salawatIntervalMinutes,
          startTime: user.salawatWindowStart,
          endTime: user.salawatWindowEnd,
        });

        if (!decision.eligible || !decision.occurrenceKey) {
          const key = decision.reason ?? 'SKIP';
          skipped[key] = (skipped[key] ?? 0) + 1;
          continue;
        }

        const claimed = await claimOccurrence(user.id, decision.occurrenceKey);
        if (!claimed) {
          skipped.DUPLICATE = (skipped.DUPLICATE ?? 0) + 1;
          continue;
        }

        const clip =
          resolveReminderAudioClip(user.salawatAudioClipId) ??
          getSalawatAudioClipById(DEFAULT_SALAWAT_AUDIO_ID);
        const dayKey = getLocalClock(now, timeZone).dayKey;
        const soundId = clip?.id || DEFAULT_SALAWAT_AUDIO_ID;
        const mediaFile = clip?.mediaFile || DEFAULT_SALAWAT_MEDIA_FILE;
        const nativeSound = DEFAULT_SALAWAT_NATIVE_SOUND;
        const dedupeKey = `${dayKey}|${user.id}|SALAWAT|SALAWAT|${decision.occurrenceKey}`;

        const fcmData: Record<string, string> = {
          type: 'SALAWAT',
          kind: 'salawat_reminder',
          eventType: 'SALAWAT',
          eventKey: 'SALAWAT',
          soundType: 'SALAWAT',
          soundId,
          audioClipId: soundId,
          mediaFile,
          nativeSound,
          androidChannelId: 'salawat',
          source: 'FCM_BACKUP',
          locale: 'ar',
          timezone: timeZone,
          dayKey,
          occurrenceKey: decision.occurrenceKey,
          dedupeKey,
          titleAr: SALAWAT_TITLE_AR,
          bodyAr: SALAWAT_BODY_AR,
          titleEn: SALAWAT_TITLE_EN,
          bodyEn: SALAWAT_BODY_EN,
        };
        if (clip?.audioUrl) fcmData.audioUrl = clip.audioUrl;

        pushesAttempted += 1;
        const result = await sendPushToUser(user.id, {
          title: SALAWAT_TITLE_AR,
          body: SALAWAT_BODY_AR,
          titleAr: SALAWAT_TITLE_AR,
          bodyAr: SALAWAT_BODY_AR,
          data: fcmData,
          nativeSound,
          androidChannelId: 'salawat',
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
            eventType: 'SALAWAT',
            eventKey: 'SALAWAT',
            soundType: 'SALAWAT',
            soundId,
            audioClipId: soundId,
            mediaFile,
            nativeSound,
            dayKey,
            occurrenceKey: decision.occurrenceKey,
            dedupeKey,
            ...(clip?.audioUrl ? { audioUrl: clip.audioUrl } : {}),
          },
        }).catch(() => null);
      } catch (err) {
        logger.warn('[Cron] Salawat reminder failed for user', {
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

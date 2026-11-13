import { mutedPrayerReminderUserIds } from './prayer-excuse.service';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import { sendPushToUser } from './device.service';
import { createNotification } from './notification.service';
import { mediaAbsoluteUrl } from './azan-audio.service';
import {
  getLocalClock,
  parseHhmm,
  normalizeHhmm,
  resolveTimezone,
} from './salawat-reminder.service';
import { evaluateMulkEligibility } from './mulk-reminder.service';
import { AZAN_PREFERENCES_USER_SELECT, buildAzanPreferencesFromUser } from './azan.service';
import { computePrayerInstantsAround } from './prayer.service';
import {
  localCoverageUntilMs,
  PUSH_TTL_SECONDS,
  REMINDER_LATE_TOLERANCE_MINUTES,
} from '../shared/utils/reminder-timing';

export const DUHA_DEFAULT_TIME = '09:30';
export const QIYAM_DEFAULT_TIME = '02:30';
export const EXTRA_PRAYER_WINDOW_MINUTES = REMINDER_LATE_TOLERANCE_MINUTES;

export const DUHA_SOUND_ID = 'sc_event_duha';
export const QIYAM_SOUND_ID = 'sc_event_qiyam';
export const DUHA_MEDIA_FILE = 'sc_event_duha.mp3';
export const QIYAM_MEDIA_FILE = 'sc_event_qiyam.mp3';
export const DUHA_NATIVE_SOUND = 'sc_event_duha';
export const QIYAM_NATIVE_SOUND = 'sc_event_qiyam';

const DUHA_TITLE_AR = 'صلاة الضحى';
const DUHA_TITLE_EN = 'Duha prayer';
const DUHA_BODY_AR = 'حان الآن موعد صلاة الضحى';
const DUHA_BODY_EN = 'It is time for Duha prayer';

const QIYAM_TITLE_AR = 'قيام الليل';
const QIYAM_TITLE_EN = 'Night prayer (Qiyam)';
const QIYAM_BODY_AR = 'حان الآن موعد صلاة قيام الليل';
const QIYAM_BODY_EN = 'It is time for Qiyam prayer';

export type ExtraPrayerKind = 'DUHA' | 'QIYAM';

export type ExtraPrayerPreferencesDto = {
  enabled: boolean;
  time: string;
  eventType: ExtraPrayerKind;
  soundId: string;
  mediaFile: string;
  nativeSound: string;
  androidChannelId: string;
  /** Stream URL for preview / in-app (not OS tray sound alone). */
  audioUrl: string;
  titleAr: string;
  bodyAr: string;
  titleEn: string;
  bodyEn: string;
  /** Soft/default tones for other reminders — Duha/Qiyam are the voice exceptions. */
  usesCustomVoice: true;
  /** Local coverage the app reported for this reminder; null = none reported or cleared. */
  localScheduledUntil: string | null;
  /** Qiyam only: FIXED = `time` every night; LAST_THIRD = start of the last third of the night (+ offsetMinutes). */
  timingMode?: QiyamTimingMode;
  offsetMinutes?: number;
  /** Qiyam LAST_THIRD: the next reminder instant (ISO) and its local HH:mm; null when the location is unknown. */
  nextAtUtc?: string | null;
  nextLocalTime?: string | null;
  locationRequired?: boolean;
};

export type QiyamTimingMode = 'FIXED' | 'LAST_THIRD';
/** Stored in users.azanPreferences JSON (no extra column / migration), next to the coverage map. */
const QIYAM_TIMING_KEY = 'qiyamTiming';

export function readQiyamTiming(azanPreferences: unknown): { mode: QiyamTimingMode; offsetMinutes: number } {
  const raw = (azanPreferences as Record<string, any> | null)?.[QIYAM_TIMING_KEY];
  const mode: QiyamTimingMode = raw?.mode === 'LAST_THIRD' ? 'LAST_THIRD' : 'FIXED';
  const off = Number(raw?.offsetMinutes);
  return { mode, offsetMinutes: Number.isInteger(off) && off >= 0 && off <= 60 ? off : 0 };
}

type LocationUser = { azanPreferences: unknown; prayerCalculationMethod: string | null; latitude: number | null; longitude: number | null; city: string | null; timezone: string | null };

/**
 * Start of the last third of the night that begins at Maghrib of `nightDate` (local) and ends at the next Fajr:
 * Maghrib + 2/3 × (Fajr − Maghrib), same rule as adhan's SunnahTimes.lastThirdOfTheNight. Null when the location is
 * unknown or a time does not exist (polar nights).
 */
export function lastThirdOfNight(user: LocationUser, nightDate: string): Date | null {
  if (user.latitude == null || user.longitude == null || !Number.isFinite(user.latitude) || !Number.isFinite(user.longitude)) return null;
  const azan = buildAzanPreferencesFromUser(user as any);
  const { instants } = computePrayerInstantsAround({
    latitude: user.latitude, longitude: user.longitude, timezone: user.timezone, method: azan.calculationMethod,
    madhab: azan.madhab, locationSource: 'profile', now: new Date(nightDate + 'T12:00:00Z'),
  });
  const next = new Date(Date.parse(nightDate + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);
  const maghrib = instants.find(i => i.key === 'MAGHRIB' && i.date === nightDate);
  const fajr = instants.find(i => i.key === 'FAJR' && i.date === next);
  if (!maghrib || !fajr || fajr.timestamp <= maghrib.timestamp) return null;
  const night = fajr.timestamp.getTime() - maghrib.timestamp.getTime();
  return new Date(Math.floor((maghrib.timestamp.getTime() + (night * 2) / 3) / 60000) * 60000);
}

/** The LAST_THIRD reminder instant closest to `now` (last night's or tonight's), with its local HH:mm. */
export function qiyamLastThirdTarget(user: LocationUser, offsetMinutes: number, now: Date, timeZone: string) {
  const today = getLocalClock(now, timeZone).dayKey;
  const yesterday = new Date(Date.parse(today + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10);
  const candidates = [yesterday, today]
    .map(d => lastThirdOfNight(user, d))
    .filter((d): d is Date => d !== null)
    .map(d => new Date(d.getTime() + offsetMinutes * 60000));
  if (!candidates.length) return null;
  const best = candidates.sort((a, b) => Math.abs(a.getTime() - now.getTime()) - Math.abs(b.getTime() - now.getTime()))[0]!;
  const c = getLocalClock(best, timeZone);
  return { at: best, localTime: `${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}`, dayKey: c.dayKey };
}

/** Next LAST_THIRD reminder after `now` (for the settings screen). */
function nextQiyamLastThird(user: LocationUser, offsetMinutes: number, now: Date) {
  const timeZone = resolveTimezone(user.timezone);
  const today = getLocalClock(now, timeZone).dayKey;
  for (const k of [-1, 0, 1]) {
    const d = new Date(Date.parse(today + 'T12:00:00Z') + k * 86400000).toISOString().slice(0, 10);
    const t = lastThirdOfNight(user, d);
    if (!t) continue;
    const at = new Date(t.getTime() + offsetMinutes * 60000);
    if (at > now) { const c = getLocalClock(at, timeZone); return { at, localTime: `${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}` }; }
  }
  return null;
}

function meta(kind: ExtraPrayerKind) {
  if (kind === 'DUHA') {
    return {
      soundId: DUHA_SOUND_ID,
      mediaFile: DUHA_MEDIA_FILE,
      nativeSound: DUHA_NATIVE_SOUND,
      androidChannelId: 'duha',
      titleAr: DUHA_TITLE_AR,
      bodyAr: DUHA_BODY_AR,
      titleEn: DUHA_TITLE_EN,
      bodyEn: DUHA_BODY_EN,
      defaultTime: DUHA_DEFAULT_TIME,
    };
  }
  return {
    soundId: QIYAM_SOUND_ID,
    mediaFile: QIYAM_MEDIA_FILE,
    nativeSound: QIYAM_NATIVE_SOUND,
    androidChannelId: 'qiyam',
    titleAr: QIYAM_TITLE_AR,
    bodyAr: QIYAM_BODY_AR,
    titleEn: QIYAM_TITLE_EN,
    bodyEn: QIYAM_BODY_EN,
    defaultTime: QIYAM_DEFAULT_TIME,
  };
}

function toDto(
  kind: ExtraPrayerKind,
  enabled: boolean,
  time: string,
  localScheduledUntil: string | null = null,
): ExtraPrayerPreferencesDto {
  const m = meta(kind);
  return {
    enabled: Boolean(enabled),
    time: normalizeHhmm(time, m.defaultTime),
    eventType: kind,
    soundId: m.soundId,
    mediaFile: m.mediaFile,
    nativeSound: m.nativeSound,
    androidChannelId: m.androidChannelId,
    audioUrl: mediaAbsoluteUrl(m.mediaFile),
    titleAr: m.titleAr,
    bodyAr: m.bodyAr,
    titleEn: m.titleEn,
    bodyEn: m.bodyEn,
    usesCustomVoice: true,
    localScheduledUntil,
  };
}

/** Key inside users.azanPreferences JSON (no extra column / migration). */
const EXTRA_COVERAGE_KEY = 'extraPrayerLocalScheduledUntil';

function coverageSlot(kind: ExtraPrayerKind): 'duha' | 'qiyam' {
  return kind === 'DUHA' ? 'duha' : 'qiyam';
}

/**
 * Coverage the app reported for this kind.
 * `reported: false` = this app build never reported it (old builds): callers keep the legacy
 * rule and reuse the Azan `localScheduledUntil`.
 */
export function readExtraPrayerCoverage(
  azanPreferences: unknown,
  kind: ExtraPrayerKind,
): { reported: boolean; until: string | null } {
  const prefs = azanPreferences as Record<string, unknown> | null;
  const map = prefs?.[EXTRA_COVERAGE_KEY] as Record<string, unknown> | null | undefined;
  const slot = coverageSlot(kind);
  if (!map || typeof map !== 'object' || !Object.prototype.hasOwnProperty.call(map, slot)) {
    return { reported: false, until: null };
  }
  const value = map[slot];
  return { reported: true, until: typeof value === 'string' ? value : null };
}

/** Instant (ISO) the cron compares against for the FCM backup of this kind. */
export function extraPrayerCoverageInstant(azanPreferences: unknown, kind: ExtraPrayerKind): string | null {
  const own = readExtraPrayerCoverage(azanPreferences, kind);
  if (own.reported) return own.until;
  const legacy = (azanPreferences as { localScheduledUntil?: unknown } | null)?.localScheduledUntil;
  return typeof legacy === 'string' ? legacy : null;
}

/**
 * New azanPreferences JSON after a Duha/Qiyam PATCH.
 * - `localScheduledUntil` in the patch → store it for this kind (null = app could not schedule).
 * - `enabled`/`time` changed without it → the old local schedule no longer matches: clear this
 *   kind, but only if the app already reports this kind (old builds keep the legacy rule).
 * Returns null when nothing changes.
 */
export function nextExtraPrayerCoverage(
  azanPreferences: unknown,
  kind: ExtraPrayerKind,
  patch: { enabled?: boolean; time?: string; localScheduledUntil?: string | null },
): Record<string, unknown> | null {
  const prefs = { ...((azanPreferences as Record<string, unknown> | null) ?? {}) };
  const current = readExtraPrayerCoverage(prefs, kind);
  const slot = coverageSlot(kind);
  const map = { ...((prefs[EXTRA_COVERAGE_KEY] as Record<string, unknown> | undefined) ?? {}) };
  if (patch.localScheduledUntil !== undefined) {
    map[slot] = patch.localScheduledUntil;
  } else if ((patch.enabled !== undefined || patch.time !== undefined) && current.reported) {
    map[slot] = null;
  } else {
    return null;
  }
  return { ...prefs, [EXTRA_COVERAGE_KEY]: map };
}

async function readExtraPrayerPreferences(userId: string, kind: ExtraPrayerKind): Promise<ExtraPrayerPreferencesDto> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      duhaReminderEnabled: true,
      duhaReminderTime: true,
      qiyamReminderEnabled: true,
      qiyamReminderTime: true,
      timezone: true,
      ...AZAN_PREFERENCES_USER_SELECT,
    },
  });
  if (!user) throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  const coverage = readExtraPrayerCoverage(user.azanPreferences, kind).until;
  if (kind === 'DUHA') return toDto('DUHA', user.duhaReminderEnabled, user.duhaReminderTime, coverage);
  const dto = toDto('QIYAM', user.qiyamReminderEnabled, user.qiyamReminderTime, coverage);
  const timing = readQiyamTiming(user.azanPreferences);
  const next = timing.mode === 'LAST_THIRD' ? nextQiyamLastThird(user as LocationUser, timing.offsetMinutes, new Date()) : null;
  return { ...dto, timingMode: timing.mode, offsetMinutes: timing.offsetMinutes,
    nextAtUtc: next?.at.toISOString() ?? null, nextLocalTime: next?.localTime ?? null,
    locationRequired: timing.mode === 'LAST_THIRD' && next === null };
}

export async function getDuhaPreferences(userId: string): Promise<ExtraPrayerPreferencesDto> {
  return readExtraPrayerPreferences(userId, 'DUHA');
}

export async function getQiyamPreferences(userId: string): Promise<ExtraPrayerPreferencesDto> {
  return readExtraPrayerPreferences(userId, 'QIYAM');
}

type ExtraPrayerPatch = { enabled?: boolean; time?: string; localScheduledUntil?: string | null; timingMode?: QiyamTimingMode; offsetMinutes?: number };

async function updateExtraPrayerPreferences(
  userId: string,
  kind: ExtraPrayerKind,
  patch: ExtraPrayerPatch,
): Promise<ExtraPrayerPreferencesDto> {
  const data: Record<string, unknown> = {};
  const enabledField = kind === 'DUHA' ? 'duhaReminderEnabled' : 'qiyamReminderEnabled';
  const timeField = kind === 'DUHA' ? 'duhaReminderTime' : 'qiyamReminderTime';
  if (typeof patch.enabled === 'boolean') data[enabledField] = patch.enabled;
  if (patch.time != null) {
    if (!parseHhmm(patch.time)) {
      throw new AppError('time must be HH:mm', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }
    data[timeField] = patch.time;
  }
  const timingPatch = patch.timingMode !== undefined || patch.offsetMinutes !== undefined;
  if (timingPatch && kind !== 'QIYAM') {
    throw new AppError('timingMode and offsetMinutes apply to Qiyam only', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
  }
  if (patch.offsetMinutes !== undefined && (!Number.isInteger(patch.offsetMinutes) || patch.offsetMinutes < 0 || patch.offsetMinutes > 60)) {
    throw new AppError('offsetMinutes must be 0..60', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
  }
  if (Object.keys(data).length === 0 && patch.localScheduledUntil === undefined && !timingPatch) {
    throw new AppError('No preference fields to update', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
  }
  await prisma.$transaction(async (db) => {
    // Lock the row: azanPreferences JSON is also written by PATCH /profile/azan-preferences.
    const rows: Array<{ azanPreferences: unknown }> =
      await db.$queryRaw`SELECT "azanPreferences" FROM "users" WHERE "id"=${userId} FOR UPDATE`;
    if (!rows.length) throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    let nextPrefs = nextExtraPrayerCoverage(rows[0]!.azanPreferences, kind,
      // A timing change invalidates the local schedule exactly like a time change.
      timingPatch && patch.time === undefined ? { ...patch, time: 'timing' } : patch);
    if (timingPatch) {
      const base = nextPrefs ?? { ...((rows[0]!.azanPreferences as Record<string, unknown> | null) ?? {}) };
      const current = readQiyamTiming(base);
      nextPrefs = { ...base, [QIYAM_TIMING_KEY]: { mode: patch.timingMode ?? current.mode, offsetMinutes: patch.offsetMinutes ?? current.offsetMinutes } };
    }
    await db.user.update({
      where: { id: userId },
      data: { ...data, ...(nextPrefs ? { azanPreferences: nextPrefs as any } : {}) },
    });
  });
  return readExtraPrayerPreferences(userId, kind);
}

export async function updateDuhaPreferences(userId: string, patch: ExtraPrayerPatch): Promise<ExtraPrayerPreferencesDto> {
  return updateExtraPrayerPreferences(userId, 'DUHA', patch);
}

export async function updateQiyamPreferences(userId: string, patch: ExtraPrayerPatch): Promise<ExtraPrayerPreferencesDto> {
  return updateExtraPrayerPreferences(userId, 'QIYAM', patch);
}

async function claimDuha(userId: string, key: string): Promise<boolean> {
  try {
    await prisma.duhaSendLog.create({ data: { userId, occurrenceKey: key } });
    return true;
  } catch (err: any) {
    if (err?.code === 'P2002') return false;
    throw err;
  }
}

async function claimQiyam(userId: string, key: string): Promise<boolean> {
  try {
    await prisma.qiyamSendLog.create({ data: { userId, occurrenceKey: key } });
    return true;
  } catch (err: any) {
    if (err?.code === 'P2002') return false;
    throw err;
  }
}

async function runKindReminders(
  kind: ExtraPrayerKind,
  now: Date,
  windowMinutes: number,
): Promise<{
  usersScanned: number;
  pushesAttempted: number;
  pushesSent: number;
  skipped: Record<string, number>;
}> {
  const m = meta(kind);
  let usersScanned = 0;
  let pushesAttempted = 0;
  let pushesSent = 0;
  const skipped: Record<string, number> = {};

  let cursor: string | undefined;
  for (;;) {
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        deviceTokens: { some: {} },
        ...(kind === 'DUHA'
          ? { duhaReminderEnabled: true }
          : { qiyamReminderEnabled: true }),
      },
      select: {
        id: true,
        timezone: true,
        duhaReminderEnabled: true,
        duhaReminderTime: true,
        qiyamReminderEnabled: true,
        qiyamReminderTime: true,
        ...AZAN_PREFERENCES_USER_SELECT,
      },
      take: 200,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    });
    if (users.length === 0) break;
    cursor = users[users.length - 1]?.id;
    usersScanned += users.length;
    const muted = await mutedPrayerReminderUserIds(users.map(u => u.id));

    for (const user of users) {
      if (muted.has(user.id)) { skipped.excuse_mode_muted = (skipped.excuse_mode_muted ?? 0) + 1; continue; }
      try {
        const timeZone = resolveTimezone(user.timezone);
        const enabled = kind === 'DUHA' ? user.duhaReminderEnabled : user.qiyamReminderEnabled;
        let reminderTime = normalizeHhmm(
          kind === 'DUHA' ? user.duhaReminderTime : user.qiyamReminderTime,
          m.defaultTime,
        );
        if (kind === 'QIYAM') {
          const timing = readQiyamTiming(user.azanPreferences);
          if (timing.mode === 'LAST_THIRD') {
            const target = qiyamLastThirdTarget(user as LocationUser, timing.offsetMinutes, now, timeZone);
            // No location (or polar night): fall back to the fixed time so the reminder is never lost.
            if (target) reminderTime = target.localTime;
          }
        }
        const decision = evaluateMulkEligibility({
          enabled,
          now,
          timeZone,
          reminderTime,
          windowMinutes,
        });
        // Reuse time-window helper; rewrite occurrence key for kind.
        const occurrenceKey =
          decision.dayKey != null ? `${decision.dayKey}|${kind}|${reminderTime}` : null;

        if (!decision.eligible || !occurrenceKey || !decision.dayKey) {
          const key = decision.reason ?? 'SKIP';
          skipped[key] = (skipped[key] ?? 0) + 1;
          continue;
        }

        const fireAtMs =
          Math.floor(now.getTime() / 60_000) * 60_000 - (decision.minutesFromTarget ?? 0) * 60_000;
        // Duha/Qiyam coverage reported by the app for this kind; old builds: the Azan coverage.
        if (fireAtMs <= localCoverageUntilMs(extraPrayerCoverageInstant(user.azanPreferences, kind), now.getTime())) {
          skipped.LOCAL_SCHEDULED = (skipped.LOCAL_SCHEDULED ?? 0) + 1;
          continue;
        }

        const claimed =
          kind === 'DUHA'
            ? await claimDuha(user.id, occurrenceKey)
            : await claimQiyam(user.id, occurrenceKey);
        if (!claimed) {
          skipped.DUPLICATE = (skipped.DUPLICATE ?? 0) + 1;
          continue;
        }

        const dayKey = decision.dayKey;
        const dedupeKey = `${dayKey}|${user.id}|${kind}|${kind}|${occurrenceKey}`;
        const audioUrl = mediaAbsoluteUrl(m.mediaFile);

        const fcmData: Record<string, string> = {
          type: kind,
          kind: kind === 'DUHA' ? 'duha_reminder' : 'qiyam_reminder',
          eventType: kind,
          eventKey: kind,
          soundType: kind,
          soundId: m.soundId,
          mediaFile: m.mediaFile,
          nativeSound: m.nativeSound,
          androidChannelId: m.androidChannelId,
          source: 'FCM_BACKUP',
          locale: 'ar',
          timezone: timeZone,
          dayKey,
          reminderTime,
          occurrenceKey,
          dedupeKey,
          audioUrl,
          titleAr: m.titleAr,
          bodyAr: m.bodyAr,
          titleEn: m.titleEn,
          bodyEn: m.bodyEn,
        };

        pushesAttempted += 1;
        const result = await sendPushToUser(user.id, {
          title: m.titleAr,
          body: m.bodyAr,
          titleAr: m.titleAr,
          bodyAr: m.bodyAr,
          data: fcmData,
          nativeSound: m.nativeSound,
          androidChannelId: m.androidChannelId,
          ttlSeconds: PUSH_TTL_SECONDS.SCHEDULED_REMINDER,
        });
        pushesSent += result.sent;

        await createNotification({
          userId: user.id,
          titleAr: m.titleAr,
          titleEn: m.titleEn,
          bodyAr: m.bodyAr,
          bodyEn: m.bodyEn,
          type: kind as any,
          deepLink: kind === 'DUHA' ? '/prayers/duha' : '/prayers/qiyam',
          payload: {
            type: kind,
            eventType: kind,
            soundType: kind,
            soundId: m.soundId,
            mediaFile: m.mediaFile,
            nativeSound: m.nativeSound,
            dayKey,
            reminderTime,
            occurrenceKey,
            dedupeKey,
            audioUrl,
          },
        }).catch(() => null);
      } catch (err) {
        logger.warn(`[Cron] ${kind} reminder failed for user`, {
          userId: user.id,
          message: (err as Error)?.message,
        });
        skipped.ERROR = (skipped.ERROR ?? 0) + 1;
      }
    }

    if (users.length < 200) break;
  }

  return { usersScanned, pushesAttempted, pushesSent, skipped };
}

export async function runDuhaReminders(now = new Date(), windowMinutes = EXTRA_PRAYER_WINDOW_MINUTES) {
  return runKindReminders('DUHA', now, windowMinutes);
}

export async function runQiyamReminders(now = new Date(), windowMinutes = EXTRA_PRAYER_WINDOW_MINUTES) {
  return runKindReminders('QIYAM', now, windowMinutes);
}

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

export const DUHA_DEFAULT_TIME = '09:30';
export const QIYAM_DEFAULT_TIME = '02:30';
export const EXTRA_PRAYER_WINDOW_MINUTES = 12;

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
};

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

function toDto(kind: ExtraPrayerKind, enabled: boolean, time: string): ExtraPrayerPreferencesDto {
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
  };
}

export async function getDuhaPreferences(userId: string): Promise<ExtraPrayerPreferencesDto> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { duhaReminderEnabled: true, duhaReminderTime: true },
  });
  if (!user) throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  return toDto('DUHA', user.duhaReminderEnabled, user.duhaReminderTime);
}

export async function getQiyamPreferences(userId: string): Promise<ExtraPrayerPreferencesDto> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { qiyamReminderEnabled: true, qiyamReminderTime: true },
  });
  if (!user) throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  return toDto('QIYAM', user.qiyamReminderEnabled, user.qiyamReminderTime);
}

export async function updateDuhaPreferences(
  userId: string,
  patch: { enabled?: boolean; time?: string },
): Promise<ExtraPrayerPreferencesDto> {
  const data: { duhaReminderEnabled?: boolean; duhaReminderTime?: string } = {};
  if (typeof patch.enabled === 'boolean') data.duhaReminderEnabled = patch.enabled;
  if (patch.time != null) {
    if (!parseHhmm(patch.time)) {
      throw new AppError('time must be HH:mm', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }
    data.duhaReminderTime = patch.time;
  }
  if (Object.keys(data).length === 0) {
    throw new AppError('No preference fields to update', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
  }
  await prisma.user.update({ where: { id: userId }, data });
  return getDuhaPreferences(userId);
}

export async function updateQiyamPreferences(
  userId: string,
  patch: { enabled?: boolean; time?: string },
): Promise<ExtraPrayerPreferencesDto> {
  const data: { qiyamReminderEnabled?: boolean; qiyamReminderTime?: string } = {};
  if (typeof patch.enabled === 'boolean') data.qiyamReminderEnabled = patch.enabled;
  if (patch.time != null) {
    if (!parseHhmm(patch.time)) {
      throw new AppError('time must be HH:mm', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }
    data.qiyamReminderTime = patch.time;
  }
  if (Object.keys(data).length === 0) {
    throw new AppError('No preference fields to update', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
  }
  await prisma.user.update({ where: { id: userId }, data });
  return getQiyamPreferences(userId);
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
        const enabled = kind === 'DUHA' ? user.duhaReminderEnabled : user.qiyamReminderEnabled;
        const reminderTime = normalizeHhmm(
          kind === 'DUHA' ? user.duhaReminderTime : user.qiyamReminderTime,
          m.defaultTime,
        );
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

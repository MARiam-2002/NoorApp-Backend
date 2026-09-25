import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { getAzanPreferences } from './azan.service';
import { sendPushToUser } from './device.service';
import { getPrayerSchedule } from './prayer.service';
import { createNotification } from './notification.service';
import {
  getLocalClock,
  resolveTimezone,
  runSalawatReminders,
} from './salawat-reminder.service';
import { DEFAULT_PRAYER_LOCATION } from '../shared/constants/default-location';
import {
  AZAN_MEDIA_FILES,
  getAzanSoundById,
  getNotificationSoundById,
  NOTIFICATION_SOUND_OPTIONS,
} from '../shared/constants/azan-sounds';
import { mediaAbsoluteUrl } from './azan-audio.service';
import * as fs from 'fs';
import * as path from 'path';

type ScheduleRow = { name: string; time: string };

const ASSETS_ROOT = path.resolve(__dirname, '..', '..', 'assets');

function isMediaFileAvailableOnDisk(mediaFile: string | null | undefined): boolean {
  if (!mediaFile) return false;
  const entry = (AZAN_MEDIA_FILES as any)[mediaFile];
  if (!entry?.relativePath) return false;
  const full = path.join(ASSETS_ROOT, entry.relativePath);
  try {
    return fs.existsSync(full);
  } catch {
    return false;
  }
}

function fallbackForMissingClip(
  requestedId: string,
): { id: string; reason: string } {
  switch (requestedId) {
    case 'sc_near_jumuah':
      if (isMediaFileAvailableOnDisk('sc_near_dhuhr.mp3')) return { id: 'sc_near_dhuhr', reason: 'jumuah->dhuhr' };
      return { id: 'soft_chime', reason: 'jumuah->soft_chime' };
    case 'sc_fajr_alarm':
      if (isMediaFileAvailableOnDisk('sc_near_fajr.mp3')) return { id: 'sc_near_fajr', reason: 'fajr_alarm->near_fajr' };
      return { id: 'soft_chime', reason: 'fajr_alarm->soft_chime' };
    case 'sc_near_qiyam':
      if (isMediaFileAvailableOnDisk('sc_near_isha.mp3')) return { id: 'sc_near_isha', reason: 'qiyam->isha' };
      return { id: 'soft_chime', reason: 'qiyam->soft_chime' };
    default:
      return { id: 'soft_chime', reason: `${requestedId}->soft_chime` };
  }
}

/**
 * Resolve pre-reminder notification sound.
 * Sentinel `sc_near_auto` → prayer-specific clip under assets/near-prayer/
 * (Fajr / Dhuhr|Jumuah Friday / Asr / Maghrib / Isha). Missing files fall back
 * safely. Explicit user picks stay unchanged (soft_chime, etc.).
 */
export function resolvePreReminderSoundFor(
  prayerName: string,
  selectedNotificationSoundId: string,
  _preReminderMinutes: number,
  evaluationTimezone: string,
  nowUtc: Date,
): { sound: typeof NOTIFICATION_SOUND_OPTIONS[number]; autoMatched: boolean } {
  const sentinel = 'sc_near_auto';
  const userPicked = String(selectedNotificationSoundId ?? '').trim().toLowerCase();
  if (userPicked !== sentinel) {
    return { sound: getNotificationSoundById(userPicked), autoMatched: false };
  }

  const prayer = String(prayerName || '').toUpperCase();
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: resolveTimezone(evaluationTimezone),
  }).format(nowUtc).toLowerCase();
  const isFriday = weekday === 'fri';

  let target = 'sc_near_fajr';
  if (prayer === 'FAJR') {
    target = 'sc_near_fajr';
  } else if (prayer === 'DHUHR') {
    target = isFriday ? 'sc_near_jumuah' : 'sc_near_dhuhr';
  } else if (prayer === 'ASR') {
    target = 'sc_near_asr';
  } else if (prayer === 'MAGHRIB') {
    target = 'sc_near_maghrib';
  } else if (prayer === 'ISHA') {
    target = 'sc_near_isha';
  } else {
    target = 'sc_near_' + prayer.toLowerCase();
  }

  let hit = NOTIFICATION_SOUND_OPTIONS.find((o) => o.id === target);
  if (hit) {
    const mediaOk = isMediaFileAvailableOnDisk(hit.mediaFile);
    if (!mediaOk) {
      const fb = fallbackForMissingClip(hit.id);
      logger.warn('[Cron] Pre-reminder clip missing on disk; falling back.', {
        requested: hit.id,
        mediaFile: hit.mediaFile,
        fallback: fb.id,
        reason: fb.reason,
      });
      const fbHit = NOTIFICATION_SOUND_OPTIONS.find((o) => o.id === fb.id);
      if (fbHit) hit = fbHit;
    }
  }
  if (hit) return { sound: hit, autoMatched: true };
  return { sound: getNotificationSoundById('soft_chime'), autoMatched: true };
}

/**
 * Minutes from "now" (in the given IANA timezone) until a local HH:mm prayer time
 * on the same local calendar day. Positive = upcoming; negative = already passed.
 * Uses Intl (same pattern as Salawat) — not the Railway/server process timezone.
 */
export function minutesUntilPrayer(
  hhmm: string,
  timeZone: string,
  now = new Date(),
): number {
  const tz = resolveTimezone(timeZone);
  const [hRaw, mRaw] = String(hhmm).split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    return Number.POSITIVE_INFINITY;
  }

  const clock = getLocalClock(now, tz);
  const nowMinutes = clock.hour * 60 + clock.minute;
  const targetMinutes = h * 60 + m;
  return targetMinutes - nowMinutes;
}

/**
 * Azan FCM backup only — unchanged rules (prefs + prayer window).
 * Now injects full audio metadata (IDs, URLs, names, muezzin) into the
 * FCM data payload so Flutter can display + play the user-selected Azan /
 * notification sound in parallel with the native notification.
 */
export async function runAzanBackupReminders(windowMinutes = 10): Promise<{
  usersScanned: number;
  pushesAttempted: number;
  pushesSent: number;
}> {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      deviceTokens: { some: {} },
    },
    select: { id: true, timezone: true, latitude: true, longitude: true },
    take: 500,
  });

  let pushesAttempted = 0;
  let pushesSent = 0;

  for (const user of users) {
    try {
      const prefs = await getAzanPreferences(user.id);
      if (!prefs.azanEnabled || prefs.fcmPrayerBackupEnabled === false) continue;

      const azanSoundRaw = getAzanSoundById(prefs.azanSoundId ?? prefs.voiceId);
      const staticNotifSoundRaw = getNotificationSoundById(prefs.notificationSoundId);
      const azanSoundUrl = azanSoundRaw.mediaFile
        ? mediaAbsoluteUrl(azanSoundRaw.mediaFile)
        : '';
      const staticNotifSoundUrl = staticNotifSoundRaw.mediaFile
        ? mediaAbsoluteUrl(staticNotifSoundRaw.mediaFile)
        : '';

      const soundEnabled = prefs.soundEnabled !== false;
      const vibrationEnabled = prefs.vibrationEnabled !== false;

      const lat = prefs.lastLat ?? user.latitude ?? DEFAULT_PRAYER_LOCATION.latitude;
      const lng = prefs.lastLng ?? user.longitude ?? DEFAULT_PRAYER_LOCATION.longitude;
      const profileTz = user.timezone ?? DEFAULT_PRAYER_LOCATION.timezone;

      const schedule = await getPrayerSchedule(
        lat,
        lng,
        profileTz,
        undefined,
        prefs.calculationMethod,
        String(prefs.madhab).toUpperCase(),
        prefs.locationSource === 'default_cairo' ||
          (user.latitude == null && user.longitude == null && prefs.isDefaultLocation)
          ? 'default_cairo'
          : 'profile',
      );
      const rows = (schedule.schedule ?? []) as ScheduleRow[];
      const evaluationTz = resolveTimezone(
        schedule.timezone || profileTz || DEFAULT_PRAYER_LOCATION.timezone,
      );

      for (const row of rows) {
        const key = row.name.toLowerCase();
        const enabled =
          (prefs.prayers as any)?.[key] === true ||
          (prefs.prayers as any)?.[key] === undefined;
        if (!enabled) continue;

        const mins = minutesUntilPrayer(row.time, evaluationTz);
        const pre = prefs.preReminderEnabled ? prefs.preReminderMinutes : 0;
        const hitNow = mins >= 0 && mins <= windowMinutes;
        const hitPre =
          prefs.preReminderEnabled &&
          mins >= pre &&
          mins <= pre + windowMinutes;

        if (!hitNow && !hitPre) continue;

        const isPre = hitPre && !hitNow;
        const kind = isPre ? 'pre_reminder' : 'prayer_time';

        const since = new Date(Date.now() - Math.max(windowMinutes, 10) * 60_000);
        const recent = await prisma.notification.findMany({
          where: {
            userId: user.id,
            type: 'AZAN' as any,
            createdAt: { gte: since },
          },
          select: { payload: true },
          take: 40,
        }).catch(() => []);
        const already = recent.some((n) => {
          const p = (n.payload ?? {}) as Record<string, unknown>;
          return p.prayer === row.name && p.kind === kind;
        });
        if (already) continue;

        const titleEn = isPre ? `${row.name} soon` : `Time for ${row.name}`;
        const titleAr = isPre ? `اقترب موعد ${row.name}` : `حان موعد صلاة ${row.name}`;
        const bodyEn = isPre
          ? `Reminder: ${row.name} in about ${pre} minutes (${row.time})`
          : `It's time for ${row.name} (${row.time})`;
        const bodyAr = isPre
          ? `تذكير: تبقى حوالي ${pre} دقيقة على ${row.name} (${row.time})`
          : `حان موعد صلاة ${row.name} (${row.time})`;

        const baseData: Record<string, string> = {
          type: 'AZAN',
          prayer: row.name,
          time: row.time,
          kind,
          soundEnabled: soundEnabled ? 'true' : 'false',
          vibrationEnabled: vibrationEnabled ? 'true' : 'false',
          locale: 'ar',
        };

        let nativeSound: string | null = 'default';
        if (!soundEnabled) {
          nativeSound = null;
        }

        if (isPre) {
          const resolved = resolvePreReminderSoundFor(
            row.name,
            prefs.notificationSoundId,
            prefs.preReminderMinutes,
            evaluationTz,
            new Date(),
          );
          let effectiveNotifSound = resolved.sound;
          if ((effectiveNotifSound as any).isAutoSentinel === true) {
            logger.warn(
              '[Cron] Pre-reminder resolver unexpectedly returned sentinel; falling back to soft_chime.',
              { userId: user.id, prayer: row.name, chosenId: prefs.notificationSoundId },
            );
            effectiveNotifSound = getNotificationSoundById('soft_chime');
          }
          const effectiveNotifSoundUrl = effectiveNotifSound.mediaFile
            ? mediaAbsoluteUrl(effectiveNotifSound.mediaFile)
            : staticNotifSoundUrl;
          const matchesPrayerKey = (effectiveNotifSound as any).matchesPrayer ?? '';

          Object.assign(baseData, {
            preReminderMinutes: String(pre ?? 0),
            audioScope: 'pre_reminder',
            autoMatched: resolved.autoMatched ? 'true' : 'false',
            matchedPrayerKey: String(matchesPrayerKey),
            notificationSoundId: effectiveNotifSound.id,
            notificationSoundNameEn: effectiveNotifSound.nameEn || '',
            notificationSoundNameAr: effectiveNotifSound.nameAr || '',
            notificationSoundUrl: effectiveNotifSoundUrl,
            notificationSoundMediaFile: effectiveNotifSound.mediaFile || '',
            notificationSoundFormat: effectiveNotifSound.format || 'none',
            notificationSoundDurationSeconds:
              effectiveNotifSound.durationSeconds != null
                ? String(effectiveNotifSound.durationSeconds)
                : '',
            notificationSoundMood:
              (effectiveNotifSound as any).mood != null
                ? String((effectiveNotifSound as any).mood)
                : '',
          });
          if (soundEnabled && effectiveNotifSound.id !== 'silent') {
            nativeSound = effectiveNotifSound.mediaFile
              ? effectiveNotifSound.mediaFile.replace(/\.mp3$/i, '')
              : 'default';
          } else if (!soundEnabled || effectiveNotifSound.id === 'silent') {
            nativeSound = null;
          }
        } else {
          Object.assign(baseData, {
            audioScope: 'prayer_time_azan',
            azanSoundId: azanSoundRaw.id,
            azanSoundNameEn: azanSoundRaw.nameEn || '',
            azanSoundNameAr: azanSoundRaw.nameAr || '',
            azanSoundUrl: azanSoundUrl,
            azanSoundPreviewUrl: azanSoundUrl,
            azanSoundMediaFile: azanSoundRaw.mediaFile || '',
            azanSoundFormat: azanSoundRaw.format || 'mp3',
            azanSoundDurationSeconds:
              azanSoundRaw.durationSeconds != null
                ? String(azanSoundRaw.durationSeconds)
                : '',
            azanSoundMuezzin: azanSoundRaw.muezzin || '',
            azanSoundMuezzinEn: azanSoundRaw.muezzinEn || '',
            azanSoundMuezzinAr: azanSoundRaw.muezzinAr || '',
            azanSoundCategory: String(azanSoundRaw.category || ''),
            azanSoundIsFamousVoice: azanSoundRaw.isFamousVoice ? 'true' : 'false',
            azanSoundProvider: String(azanSoundRaw.provider || ''),
          });
          if (soundEnabled) {
            nativeSound = azanSoundRaw.mediaFile
              ? azanSoundRaw.mediaFile.replace(/\.mp3$/i, '')
              : 'default';
          } else {
            nativeSound = null;
          }
        }

        Object.assign(baseData, {
          titleAr,
          bodyAr,
          titleEn,
          bodyEn,
        });

        pushesAttempted += 1;
        const result = await sendPushToUser(user.id, {
          title: titleEn,
          body: bodyEn,
          titleAr,
          bodyAr,
          data: baseData,
          nativeSound,
          androidChannelId: isPre ? 'azan-reminder' : 'azan',
        });
        pushesSent += result.sent;

        await createNotification({
          userId: user.id,
          titleAr,
          titleEn,
          bodyAr,
          bodyEn,
          type: 'AZAN' as any,
          deepLink: '/prayer-times',
          payload: {
            prayer: row.name,
            time: row.time,
            kind,
            audioScope: baseData.audioScope,
            azanSoundId: baseData.azanSoundId,
            azanSoundUrl: baseData.azanSoundUrl,
            notificationSoundId: baseData.notificationSoundId,
            notificationSoundUrl: baseData.notificationSoundUrl,
          },
        }).catch(() => null);
      }
    } catch (err) {
      logger.warn('[Cron] Prayer reminder failed for user', {
        userId: user.id,
        message: (err as Error)?.message,
      });
    }
  }

  return { usersScanned: users.length, pushesAttempted, pushesSent };
}

/**
 * Existing cron entrypoint (every ~10 minutes).
 * Runs Azan backup + Salawat reminders in the same job — no separate scheduler.
 */
export async function runPrayerReminderCron(windowMinutes = 10): Promise<{
  usersScanned: number;
  pushesAttempted: number;
  pushesSent: number;
  azan: { usersScanned: number; pushesAttempted: number; pushesSent: number };
  salawat: {
    usersScanned: number;
    pushesAttempted: number;
    pushesSent: number;
    skipped: Record<string, number>;
  };
}> {
  const azan = await runAzanBackupReminders(windowMinutes);
  const salawat = await runSalawatReminders();

  return {
    usersScanned: azan.usersScanned + salawat.usersScanned,
    pushesAttempted: azan.pushesAttempted + salawat.pushesAttempted,
    pushesSent: azan.pushesSent + salawat.pushesSent,
    azan,
    salawat,
  };
}

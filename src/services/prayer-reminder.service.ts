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
import { PrayerLabelsAr, PrayerNameEnum } from '../shared/enums/prayer-name.enum';
import { parsePrayerKey } from '../shared/utils/prayer-names';
import { mediaAbsoluteUrl } from './azan-audio.service';
import * as fs from 'fs';
import * as path from 'path';

type ScheduleRow = {
  name: string;
  time: string;
  key?: string;
  nameAr?: string;
  /** Local calendar date YYYY-MM-DD from getPrayerSchedule when present. */
  date?: string;
};

/**
 * Canonical Arabic near-prayer / prayer-time notification titles.
 * Flutter local scheduling should use the same copy rules.
 * Friday Dhuhr pre-reminder uses الجمعة.
 */
export function formatPreReminderMinutesPhraseAr(minutes: number): string {
  const n = Math.max(0, Math.floor(Number(minutes) || 0));
  if (n === 1) return 'دقيقة';
  return `${n} دقيقة`;
}

export function buildAzanNotificationCopy(input: {
  prayerNameOrKey: string;
  time: string;
  isPre: boolean;
  preReminderMinutes: number;
  evaluationTimezone: string;
  nowUtc?: Date;
}): {
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  prayerKey: PrayerNameEnum | string;
  prayerTitle: string;
  nameAr: string;
  isFridayJumuahPre: boolean;
  /** Additive Flutter event type (does not replace `kind`). */
  eventType: 'PRE_PRAYER_REMINDER' | 'PRAYER_AZAN';
} {
  const now = input.nowUtc ?? new Date();
  const prayerKey =
    parsePrayerKey(input.prayerNameOrKey) ??
    String(input.prayerNameOrKey || '').toUpperCase();
  const prayerTitle =
    prayerKey === PrayerNameEnum.FAJR
      ? 'Fajr'
      : prayerKey === PrayerNameEnum.DHUHR
        ? 'Dhuhr'
        : prayerKey === PrayerNameEnum.ASR
          ? 'Asr'
          : prayerKey === PrayerNameEnum.MAGHRIB
            ? 'Maghrib'
            : prayerKey === PrayerNameEnum.ISHA
              ? 'Isha'
              : String(input.prayerNameOrKey);

  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: resolveTimezone(input.evaluationTimezone),
  })
    .format(now)
    .toLowerCase();
  const isFriday = weekday === 'fri';
  const isFridayJumuahPre =
    input.isPre && isFriday && prayerKey === PrayerNameEnum.DHUHR;

  const nameAr = isFridayJumuahPre
    ? 'الجمعة'
    : (PrayerLabelsAr as Record<string, string>)[prayerKey] ??
      String(input.prayerNameOrKey);

  const pre = Math.max(0, Math.floor(Number(input.preReminderMinutes) || 0));
  const prePhraseAr = formatPreReminderMinutesPhraseAr(pre);

  const titleEn = input.isPre
    ? pre === 1
      ? `${prayerTitle} in 1 minute`
      : `${prayerTitle} in ${pre} minutes`
    : `Azan time for ${prayerTitle}`;
  // Product copy (Flutter settings screen contract):
  // PRE: بعد دقيقة يحين موعد صلاة العصر | بعد 15 دقيقة يحين موعد صلاة العصر
  // AZAN: حان الآن موعد أذان العصر
  const titleAr = input.isPre
    ? pre === 1
      ? `بعد دقيقة يحين موعد صلاة ${nameAr}`
      : `بعد ${pre} دقيقة يحين موعد صلاة ${nameAr}`
    : `حان الآن موعد أذان ${nameAr}`;
  const bodyEn = input.isPre
    ? `Reminder: ${prayerTitle} in about ${pre} minutes (${input.time})`
    : `It's time for the ${prayerTitle} Azan (${input.time})`;
  const bodyAr = input.isPre
    ? `تذكير: بعد ${prePhraseAr} يحين موعد صلاة ${nameAr} (${input.time})`
    : `حان الآن موعد أذان ${nameAr} (${input.time})`;

  return {
    titleEn,
    titleAr,
    bodyEn,
    bodyAr,
    prayerKey,
    prayerTitle,
    nameAr,
    isFridayJumuahPre,
    eventType: input.isPre ? 'PRE_PRAYER_REMINDER' : 'PRAYER_AZAN',
  };
}

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
 * Classify whether the cron should fire a Near-Prayer (pre) or prayer-time push.
 *
 * `preReminderMinutes` is authoritative: target fire when minutes-until ≈ pre.
 * Cron window only provides tolerance — it does NOT replace the user's minutes.
 *
 * When both windows overlap (e.g. pre=5, window=12), pick the closer target so
 * Near-Prayer is not swallowed by prayer_time.
 */
export function classifyAzanReminderHit(input: {
  minutesUntil: number;
  preReminderMinutes: number;
  preReminderEnabled: boolean;
  windowMinutes: number;
}): 'none' | 'pre_reminder' | 'prayer_time' {
  const mins = input.minutesUntil;
  const window = Math.max(1, input.windowMinutes);
  if (!Number.isFinite(mins) || mins < 0) return 'none';

  const preEnabled = Boolean(input.preReminderEnabled);
  const pre = preEnabled ? Math.max(0, Math.floor(Number(input.preReminderMinutes) || 0)) : 0;

  const inNowWindow = mins <= window;
  // Pre target is exactly `pre` minutes before prayer. Accept within ±window.
  const inPreWindow =
    preEnabled && pre > 0 && Math.abs(mins - pre) <= window;

  if (inPreWindow && inNowWindow) {
    return Math.abs(mins - pre) <= mins ? 'pre_reminder' : 'prayer_time';
  }
  if (inPreWindow) return 'pre_reminder';
  if (inNowWindow) return 'prayer_time';
  return 'none';
}

/** Deterministic logical identity for one Azan/Near-Prayer send. */
export function buildAzanReminderOccurrenceKey(input: {
  date: string;
  prayerKey: string;
  kind: 'pre_reminder' | 'prayer_time';
  /** Included for pre_reminder so changing minutes creates a new logical reminder. */
  preReminderMinutes?: number;
}): string {
  const prayer = String(input.prayerKey).toUpperCase();
  if (input.kind === 'pre_reminder') {
    const pre = Math.max(0, Math.floor(Number(input.preReminderMinutes) || 0));
    return `${input.date}|${prayer}|pre_reminder|pre${pre}`;
  }
  return `${input.date}|${prayer}|prayer_time`;
}

export async function claimAzanReminderOccurrence(
  userId: string,
  occurrenceKey: string,
): Promise<boolean> {
  try {
    await prisma.azanReminderSendLog.create({
      data: { userId, occurrenceKey },
    });
    return true;
  } catch (err: any) {
    if (err?.code === 'P2002') return false;
    throw err;
  }
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
 * Local notification clock time (HH:mm) for a near-prayer reminder.
 * Example: prayer 05:00, pre=15 → "04:45".
 */
export function computeNearPrayerLocalHhmm(prayerHhmm: string, preReminderMinutes: number): string {
  const [hRaw, mRaw] = String(prayerHhmm).split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return prayerHhmm;
  const pre = Math.max(0, Math.floor(Number(preReminderMinutes) || 0));
  let total = h * 60 + m - pre;
  if (total < 0) total += 24 * 60;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
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
      const scheduleDate =
        typeof (schedule as any).date === 'string'
          ? String((schedule as any).date)
          : getLocalClock(new Date(), evaluationTz).dayKey;

      for (const row of rows) {
        const prayerEnum =
          parsePrayerKey(row.key ?? row.name) ??
          String(row.key ?? row.name).toUpperCase();
        const prefKey = String(prayerEnum).toLowerCase();
        const enabled =
          (prefs.prayers as any)?.[prefKey] === true ||
          (prefs.prayers as any)?.[prefKey] === undefined;
        if (!enabled) continue;

        const mins = minutesUntilPrayer(row.time, evaluationTz);
        const pre = prefs.preReminderEnabled ? prefs.preReminderMinutes : 0;
        const hitKind = classifyAzanReminderHit({
          minutesUntil: mins,
          preReminderMinutes: prefs.preReminderMinutes,
          preReminderEnabled: prefs.preReminderEnabled,
          windowMinutes,
        });
        if (hitKind === 'none') continue;

        const isPre = hitKind === 'pre_reminder';
        const kind = hitKind;
        const occurrenceKey = buildAzanReminderOccurrenceKey({
          date: scheduleDate,
          prayerKey: String(prayerEnum),
          kind,
          preReminderMinutes: isPre ? pre : undefined,
        });

        // Durable claim BEFORE FCM — protects overlapping/retried cron runs.
        let claimed = false;
        try {
          claimed = await claimAzanReminderOccurrence(user.id, occurrenceKey);
        } catch (claimErr) {
          logger.warn('[Cron] Azan reminder claim failed; falling back to notification scan', {
            userId: user.id,
            occurrenceKey,
            message: (claimErr as Error)?.message,
          });
          // Fallback if migration not yet applied: soft dedup via recent notifications.
          const since = new Date(Date.now() - Math.max(windowMinutes, pre, 30) * 60_000);
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
            if (p.idempotencyKey && String(p.idempotencyKey) === occurrenceKey) return true;
            if (p.kind !== kind) return false;
            const prevKey =
              parsePrayerKey(String(p.key ?? p.prayer ?? '')) ??
              String(p.prayer ?? '').toUpperCase();
            if (prevKey !== prayerEnum) return false;
            if (isPre && p.preReminderMinutes != null && Number(p.preReminderMinutes) !== pre) {
              return false;
            }
            if (p.date && scheduleDate && String(p.date) !== scheduleDate) return false;
            return true;
          });
          if (already) continue;
          claimed = true;
        }
        if (!claimed) continue;

        const copy = buildAzanNotificationCopy({
          prayerNameOrKey: String(prayerEnum),
          time: row.time,
          isPre,
          preReminderMinutes: pre,
          evaluationTimezone: evaluationTz,
        });
        const { titleEn, titleAr, bodyEn, bodyAr, prayerTitle, eventType } = copy;
        const nearPrayerLocalTime = isPre
          ? computeNearPrayerLocalHhmm(row.time, pre)
          : row.time;

        const baseData: Record<string, string> = {
          type: 'AZAN',
          /** Title Case — backward compatible with existing Flutter maps. */
          prayer: prayerTitle,
          /** Canonical enum — prefer this for new client logic. */
          key: String(prayerEnum),
          date: scheduleDate,
          time: row.time,
          kind,
          /** Additive event taxonomy for Flutter local + FCM (does not replace kind). */
          eventType,
          idempotencyKey: occurrenceKey,
          occurrenceKey,
          soundEnabled: soundEnabled ? 'true' : 'false',
          vibrationEnabled: vibrationEnabled ? 'true' : 'false',
          locale: 'ar',
          deepLink: '/prayer-times',
        };

        let nativeSound: string | null = 'default';
        if (!soundEnabled) {
          nativeSound = null;
        }

        if (isPre) {
          const resolved = resolvePreReminderSoundFor(
            String(prayerEnum),
            prefs.notificationSoundId,
            prefs.preReminderMinutes,
            evaluationTz,
            new Date(),
          );
          let effectiveNotifSound = resolved.sound;
          if ((effectiveNotifSound as any).isAutoSentinel === true) {
            logger.warn(
              '[Cron] Pre-reminder resolver unexpectedly returned sentinel; falling back to soft_chime.',
              { userId: user.id, prayer: prayerEnum, chosenId: prefs.notificationSoundId },
            );
            effectiveNotifSound = getNotificationSoundById('soft_chime');
          }
          const effectiveNotifSoundUrl = effectiveNotifSound.mediaFile
            ? mediaAbsoluteUrl(effectiveNotifSound.mediaFile)
            : staticNotifSoundUrl;
          const matchesPrayerKey = (effectiveNotifSound as any).matchesPrayer ?? '';

          Object.assign(baseData, {
            preReminderMinutes: String(pre ?? 0),
            /** Alias for Flutter UIs that label the field reminderMinutes. */
            reminderMinutes: String(pre ?? 0),
            nearPrayerLocalTime,
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
            prayer: prayerTitle,
            key: String(prayerEnum),
            date: scheduleDate,
            time: row.time,
            kind,
            idempotencyKey: occurrenceKey,
            occurrenceKey,
            preReminderMinutes: isPre ? pre : undefined,
            nearPrayerLocalTime: isPre ? nearPrayerLocalTime : undefined,
            audioScope: baseData.audioScope,
            azanSoundId: baseData.azanSoundId,
            azanSoundUrl: baseData.azanSoundUrl,
            notificationSoundId: baseData.notificationSoundId,
            notificationSoundUrl: baseData.notificationSoundUrl,
            notificationSoundMediaFile: baseData.notificationSoundMediaFile,
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
